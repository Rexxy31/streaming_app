package com.streamapp.service;

import com.streamapp.entity.Lecture;
import com.streamapp.repository.LectureRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TranscriptionService {

    private final S3Service s3Service;
    private final S3Client s3Client;
    private final LectureRepository lectureRepository;

    @Value("${app.ffmpeg-path:/usr/bin/ffmpeg}")
    private String ffmpegPath;

    @Value("${app.whisper-model:base}")
    private String whisperModel;

    @Value("${app.whisper-command:whisper}")
    private String whisperCommand;

    @Value("${app.whisper-device:cuda}")
    private String whisperDevice;

    @Value("${aws.s3.bucket-name}")

    private String bucketName;

    /**
     * Generate subtitles for all lectures missing them, or for a specific course.
     * Runs asynchronously, reuses S3Service progress tracking.
     */
    @Async
    public void generateSubtitlesAsync(UUID courseId) {
        if (s3Service.getCurrentProgress().isActive()) {
            log.warn("Another operation is already in progress. Skipping subtitle generation.");
            return;
        }

        s3Service.markScanActive("Finding lectures without subtitles...");

        try {
            List<Lecture> lectures;
            if (courseId != null) {
                lectures = lectureRepository.findAll().stream()
                        .filter(l -> l.getSection().getCourse().getId().equals(courseId))
                        .collect(Collectors.toList());
            } else {
                lectures = lectureRepository.findAll();
            }

            // Filter to only lectures missing subtitles
            List<Lecture> needsSubtitles = lectures.stream()
                    .filter(l -> s3Service.findSubtitleKey(l.getS3Key()).isEmpty())
                    .collect(Collectors.toList());

            if (needsSubtitles.isEmpty()) {
                log.info("All lectures already have subtitles.");
                s3Service.markScanActive("No lectures need subtitles.");
                return;
            }

            log.info("Found {} lectures needing subtitles", needsSubtitles.size());
            s3Service.getCurrentProgress(); // ensure progress is visible
            // Reset counters via a dedicated method would be cleaner, but reuse markScanActive
            s3Service.markScanActive("Generating subtitles (0/" + needsSubtitles.size() + ")...");

            int total = needsSubtitles.size();
            int completed = 0;
            int failed = 0;

            for (Lecture lecture : needsSubtitles) {
                completed++;
                String status = String.format("Transcribing %d/%d: %s", completed, total, truncate(lecture.getTitle(), 40));
                s3Service.markScanActive(status);

                try {
                    transcribeLecture(lecture);
                    log.info("Successfully transcribed: {}", lecture.getTitle());
                } catch (Exception e) {
                    failed++;
                    log.error("Failed to transcribe {}: {}", lecture.getTitle(), e.getMessage());
                    // Update status to show failure reason for at least one
                    if (failed == 1) {
                         s3Service.markScanActive("Error on first: " + truncate(e.getMessage(), 50));
                         Thread.sleep(2000); // let user see it
                    }
                }
            }

            String result = String.format("Done! %d/%d transcribed, %d failed.", completed - failed, total, failed);
            s3Service.markScanActive(result);
            log.info("Subtitle generation complete: {}", result);

        } catch (Exception e) {
            log.error("Subtitle generation failed: {}", e.getMessage(), e);
            s3Service.markScanActive("Subtitle generation failed: " + e.getMessage());
        }
    }

    private void transcribeLecture(Lecture lecture) throws Exception {
        Path tempDir = Files.createTempDirectory("whisper-");
        Path audioFile = tempDir.resolve("audio.mp3");
        Path srtFile = tempDir.resolve("audio.srt");

        try {
            // Step 1: Extract audio from video via presigned URL
            String presignedUrl = s3Service.generatePresignedUrl(lecture.getS3Key());
            log.info("Extracting audio for: {}", lecture.getTitle());

            ProcessBuilder extractPb = new ProcessBuilder(
                    ffmpegPath,
                    "-i", presignedUrl,
                    "-vn",                    // no video
                    "-acodec", "libmp3lame",  // MP3 codec
                    "-ab", "64k",             // low bitrate to keep file small
                    "-ar", "16000",           // 16kHz sample rate (whisper prefers this)
                    "-ac", "1",               // mono
                    "-y",                     // overwrite
                    audioFile.toString()
            );
            extractPb.redirectErrorStream(true);
            Process extractProcess = extractPb.start();

            // Drain output to prevent blocking
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(extractProcess.getInputStream()))) {
                while (reader.readLine() != null) { /* drain */ }
            }

            boolean extractDone = extractProcess.waitFor(15, TimeUnit.MINUTES);
            if (!extractDone) {
                extractProcess.destroyForcibly();
                throw new RuntimeException("Audio extraction timed out for: " + lecture.getTitle());
            }
            // Step 2: Run whisper on the audio file
            log.info("Running: {} {} --model {} --output_format srt", whisperCommand, audioFile, whisperModel);
            ProcessBuilder whisperPb = new ProcessBuilder(
                    whisperCommand,
                    audioFile.toString(),
                    "--model", whisperModel,
                    "--device", whisperDevice,
                    "--output_format", "srt",
                    "--output_dir", tempDir.toString(),
                    "--language", "en"

            );
            
            // CRITICAL: Whisper CLI needs ffmpeg in the system PATH to work.
            // On Windows, we must add the folder containing ffmpeg.exe to the process PATH.
            Map<String, String> env = whisperPb.environment();
            String pathVar = env.entrySet().stream()
                    .filter(entry -> entry.getKey().equalsIgnoreCase("PATH"))
                    .map(Map.Entry::getValue)
                    .findFirst()
                    .orElse("");
            
            Path ffmpegDir = Path.of(ffmpegPath).getParent();
            if (ffmpegDir != null) {
                String separator = System.getProperty("os.name").toLowerCase().contains("win") ? ";" : ":";
                env.put("PATH", ffmpegDir.toString() + separator + pathVar);
            }

            whisperPb.redirectErrorStream(true);
            Process whisperProcess;
            try {
                whisperProcess = whisperPb.start();
            } catch (Exception e) {
                throw new RuntimeException("Failed to start whisper process (" + whisperCommand + "): " + e.getMessage());
            }

            StringBuilder whisperOutput = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(whisperProcess.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info("Whisper: {}", line);
                    whisperOutput.append(line).append("\n");
                }
            }

            boolean whisperDone = whisperProcess.waitFor(60, TimeUnit.MINUTES);
            if (!whisperDone) {
                whisperProcess.destroyForcibly();
                throw new RuntimeException("Whisper transcription timed out for: " + lecture.getTitle());
            }
            if (whisperProcess.exitValue() != 0) {
                log.error("Whisper failed! Output:\n{}", whisperOutput.toString());
                throw new RuntimeException("Whisper failed with exit code: " + whisperProcess.exitValue());
            }

            if (!Files.exists(srtFile) || Files.size(srtFile) == 0) {
                throw new RuntimeException("Whisper produced no SRT output for: " + lecture.getTitle());
            }

            // Step 3: Upload SRT to S3 alongside the video
            String videoKey = lecture.getS3Key();
            String srtKey = videoKey.replaceFirst("\\.[^.]+$", ".srt");

            log.info("Uploading SRT to S3: {}", srtKey);
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucketName)
                            .key(srtKey)
                            .contentType("application/x-subrip")
                            .build(),
                    RequestBody.fromFile(srtFile)
            );

            // Step 4: Clear caches so the new subtitle is discoverable
            s3Service.clearSubtitleCache(videoKey);

            log.info("Subtitle uploaded for: {} -> {}", lecture.getTitle(), srtKey);

        } finally {
            // Clean up temp files
            try {
                Files.deleteIfExists(audioFile);
                Files.deleteIfExists(srtFile);
                Files.deleteIfExists(tempDir);
            } catch (Exception e) {
                log.warn("Failed to clean temp files: {}", e.getMessage());
            }
        }
    }

    private String truncate(String text, int maxLength) {
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
