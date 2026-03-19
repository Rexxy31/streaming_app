package com.streamapp.service;

import com.streamapp.dto.LectureHealthDTO;
import com.streamapp.dto.SyncProgressDTO;
import com.streamapp.dto.TranscriptCueDTO;
import com.streamapp.entity.Course;
import com.streamapp.entity.Lecture;
import com.streamapp.entity.Section;
import com.streamapp.repository.CourseRepository;
import com.streamapp.repository.LectureRepository;
import com.streamapp.repository.SectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import java.io.BufferedReader;
import java.io.InputStreamReader;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final LectureRepository lectureRepository;
    private final ExecutorService metadataExecutor = Executors.newFixedThreadPool(4);
    
    @Value("${app.ffmpeg-path:/usr/bin/ffmpeg}")
    private String ffmpegPath;

    private final AtomicInteger currentCount = new AtomicInteger(0);
    private final AtomicInteger totalCount = new AtomicInteger(0);
    private final Map<String, Optional<String>> subtitleKeyCache = new ConcurrentHashMap<>();
    private final Map<String, List<TranscriptCueDTO>> transcriptCache = new ConcurrentHashMap<>();
    private volatile String currentStatus = "Idle";
    private volatile boolean isScanning = false;

    public SyncProgressDTO getCurrentProgress() {
        return SyncProgressDTO.builder()
                .active(isScanning)
                .status(currentStatus)
                .current(currentCount.get())
                .total(totalCount.get())
                .build();
    }

    public void markScanActive(String initialStatus) {
        isScanning = true;
        currentStatus = initialStatus;
        currentCount.set(0);
        totalCount.set(0);
    }

    @Async
    public void scanAndSyncAsync() {
        scanAndSync();
    }

    @Async
    public void refreshAllMetadataAsync() {
        refreshAllMetadata();
    }

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.presigned-url-expiration-minutes}")
    private int presignedUrlExpirationMinutes;

    // Pattern to extract order number and name from S3 folder/file names like "1-Getting-Started" or "01_Introduction"
    private static final Pattern ORDER_NAME_PATTERN = Pattern.compile("^(\\d+)[-_\\.\\s]+(.+)$");

    /**
     * Generate a pre-signed URL for streaming a video from S3.
     */
    public String generatePresignedUrl(String s3Key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(presignedUrlExpirationMinutes))
                .getObjectRequest(getObjectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    public Optional<String> findSubtitleKey(String s3Key) {
        if (subtitleKeyCache.containsKey(s3Key)) {
            return subtitleKeyCache.get(s3Key);
        }

        String baseKey = s3Key.replaceFirst("\\.[^.]+$", "");
        for (String suffix : List.of(".vtt", ".srt", "_en.vtt", "_en.srt", ".en.vtt", ".en.srt")) {
            String candidateKey = baseKey + suffix;
            if (objectExists(candidateKey)) {
                Optional<String> found = Optional.of(candidateKey);
                subtitleKeyCache.put(s3Key, found);
                return found;
            }
        }
        Optional<String> found = findSubtitleKeyInSameDirectory(s3Key);
        subtitleKeyCache.put(s3Key, found);
        return found;
    }

    public String loadSubtitleAsWebVtt(String s3Key) {
        try (ResponseInputStream<GetObjectResponse> stream = s3Client.getObject(GetObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .build());
             BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
            String subtitleText = reader.lines().reduce((a, b) -> a + "\n" + b).orElse("");
            if (s3Key.toLowerCase().endsWith(".vtt")) {
                return subtitleText.startsWith("WEBVTT") ? subtitleText : "WEBVTT\n\n" + subtitleText;
            }

            return "WEBVTT\n\n" + subtitleText
                    .replace("\r", "")
                    .replaceAll("(\\d{2}:\\d{2}:\\d{2}),(\\d{3})", "$1.$2");
        } catch (Exception e) {
            throw new NoSuchElementException("Subtitle not found or unreadable: " + s3Key);
        }
    }

    public boolean objectExists(String s3Key) {
        try {
            HeadObjectResponse ignored = s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Key)
                    .build());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Optional<String> findSubtitleKeyInSameDirectory(String s3Key) {
        int lastSlash = s3Key.lastIndexOf('/');
        String directoryPrefix = lastSlash >= 0 ? s3Key.substring(0, lastSlash + 1) : "";
        String videoStem = stripLanguageSuffix(stripExtension(fileNameOf(s3Key)));
        String normalizedVideoStem = normalizeStem(videoStem);

        ListObjectsV2Response response = s3Client.listObjectsV2(ListObjectsV2Request.builder()
                .bucket(bucketName)
                .prefix(directoryPrefix)
                .build());

        return response.contents().stream()
                .map(S3Object::key)
                .filter(this::isSubtitleFile)
                .max(Comparator.comparingInt(key -> subtitleMatchScore(normalizedVideoStem, key)))
                .filter(key -> subtitleMatchScore(normalizedVideoStem, key) > 0);
    }

    public List<TranscriptCueDTO> loadTranscriptCues(String s3Key) {
        return transcriptCache.computeIfAbsent(s3Key, key -> findSubtitleKey(key)
                .map(this::loadSubtitleAsWebVtt)
                .map(this::parseTranscriptCues)
                .orElse(List.of()));
    }

    public String getSubtitleStatus(String s3Key) {
        return findSubtitleKey(s3Key).isPresent() ? "available" : "missing";
    }

    public LectureHealthDTO buildLectureHealth(Lecture lecture) {
        boolean videoPresent = objectExists(lecture.getS3Key());
        Optional<String> subtitleKey = findSubtitleKey(lecture.getS3Key());
        return LectureHealthDTO.builder()
                .lectureId(lecture.getId())
                .lectureTitle(lecture.getTitle())
                .sectionTitle(lecture.getSection().getTitle())
                .videoPresent(videoPresent)
                .subtitlePresent(subtitleKey.isPresent())
                .subtitleStatus(subtitleKey.isPresent() ? "available" : "missing")
                .durationSeconds(lecture.getDurationSeconds())
                .build();
    }

    private int subtitleMatchScore(String normalizedVideoStem, String subtitleKey) {
        String subtitleStem = stripLanguageSuffix(stripExtension(fileNameOf(subtitleKey)));
        String normalizedSubtitleStem = normalizeStem(subtitleStem);
        String videoSemanticStem = normalizeStem(extractName(stripLeadingOrderDecorators(normalizedVideoStem)));
        String subtitleSemanticStem = normalizeStem(extractName(stripLeadingOrderDecorators(subtitleStem)));

        if (normalizedSubtitleStem.equals(normalizedVideoStem)) return 100;
        if (!videoSemanticStem.isEmpty() && videoSemanticStem.equals(subtitleSemanticStem)) return 95;
        if (normalizedVideoStem.startsWith(normalizedSubtitleStem) || normalizedSubtitleStem.startsWith(normalizedVideoStem)) return 80;

        String videoTail = stripLeadingOrder(normalizedVideoStem);
        String subtitleTail = stripLeadingOrder(normalizedSubtitleStem);
        if (!videoTail.isEmpty() && videoTail.equals(subtitleTail)) return 75;
        if (!videoTail.isEmpty() && !subtitleTail.isEmpty()
                && (videoTail.startsWith(subtitleTail) || subtitleTail.startsWith(videoTail))) {
            return 60;
        }

        String videoPrefix = extractLeadingOrder(normalizedVideoStem);
        String subtitlePrefix = extractLeadingOrder(normalizedSubtitleStem);
        if (!videoPrefix.isEmpty() && videoPrefix.equals(subtitlePrefix)) return 40;

        return 0;
    }

    private boolean isSubtitleFile(String key) {
        String lower = key.toLowerCase();
        return lower.endsWith(".vtt") || lower.endsWith(".srt");
    }

    private List<TranscriptCueDTO> parseTranscriptCues(String subtitleText) {
        if (subtitleText == null || subtitleText.isBlank()) {
            return List.of();
        }

        return Arrays.stream(subtitleText.replace("\r", "")
                        .replaceFirst("^WEBVTT\\s*", "")
                        .trim()
                        .split("\\n\\s*\\n"))
                .map(String::trim)
                .filter(block -> !block.isBlank())
                .map(this::parseTranscriptCue)
                .filter(Objects::nonNull)
                .toList();
    }

    private TranscriptCueDTO parseTranscriptCue(String block) {
        List<String> lines = Arrays.stream(block.split("\\n"))
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .toList();
        if (lines.size() < 2) {
            return null;
        }

        int timingLineIndex = -1;
        for (int i = 0; i < lines.size(); i++) {
            if (lines.get(i).contains("-->")) {
                timingLineIndex = i;
                break;
            }
        }

        if (timingLineIndex < 0) {
            return null;
        }

        String[] timingParts = lines.get(timingLineIndex).split("-->");
        if (timingParts.length != 2) {
            return null;
        }

        Integer startSeconds = parseTimestamp(timingParts[0].trim().split("\\s+")[0]);
        Integer endSeconds = parseTimestamp(timingParts[1].trim().split("\\s+")[0]);
        if (startSeconds == null || endSeconds == null) {
            return null;
        }

        String text = lines.subList(timingLineIndex + 1, lines.size()).stream()
                .map(line -> line.replaceAll("<[^>]+>", ""))
                .collect(java.util.stream.Collectors.joining(" "))
                .replaceAll("\\s{2,}", " ")
                .trim();

        if (text.isBlank()) {
            return null;
        }

        return TranscriptCueDTO.builder()
                .startSeconds(startSeconds)
                .endSeconds(endSeconds)
                .text(text)
                .build();
    }

    private Integer parseTimestamp(String value) {
        String[] parts = value.replace(",", ".").split(":");
        if (parts.length != 3) {
            return null;
        }

        try {
            int hours = Integer.parseInt(parts[0]);
            int minutes = Integer.parseInt(parts[1]);
            double seconds = Double.parseDouble(parts[2]);
            return (int) Math.floor(hours * 3600 + minutes * 60 + seconds);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String fileNameOf(String key) {
        int lastSlash = key.lastIndexOf('/');
        return lastSlash >= 0 ? key.substring(lastSlash + 1) : key;
    }

    private String stripExtension(String fileName) {
        return fileName.replaceFirst("\\.[^.]+$", "");
    }

    private String stripLanguageSuffix(String fileStem) {
        return fileStem.replaceFirst("([._-])(en|eng|english)$", "");
    }

    private String stripLeadingOrderDecorators(String input) {
        return input.replaceFirst("^\\d+[._\\-\\s]*", "");
    }

    private String normalizeStem(String input) {
        return input.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private String extractLeadingOrder(String normalizedStem) {
        Matcher matcher = Pattern.compile("^(\\d+)").matcher(normalizedStem);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String stripLeadingOrder(String normalizedStem) {
        return normalizedStem.replaceFirst("^\\d+", "");
    }

    /**
     * Scan the entire S3 bucket and sync courses/sections/lectures into the database.
     */
    public Map<String, Object> scanAndSync() {
        isScanning = true;
        try {
            currentStatus = "Listing S3 objects...";
            currentCount.set(0);
            totalCount.set(0);
            log.info("Starting S3 bucket scan: {}", bucketName);

            ListObjectsV2Request request = ListObjectsV2Request.builder()
                    .bucket(bucketName)
                    .build();

            List<String> videoKeys = new ArrayList<>();
            ListObjectsV2Response response;

            do {
                response = s3Client.listObjectsV2(request);
                for (S3Object s3Object : response.contents()) {
                    String key = s3Object.key();
                    if (isVideoFile(key) && !key.endsWith("/")) {
                        videoKeys.add(key);
                    }
                }
                request = request.toBuilder()
                        .continuationToken(response.nextContinuationToken())
                        .build();
            } while (response.isTruncated());

            log.info("Found {} video files in S3", videoKeys.size());

            int coursesCreated = 0, sectionsCreated = 0, lecturesCreated = 0;

            // Group videos by course (first path segment)
            Map<String, List<String>> courseVideos = new TreeMap<>();
            for (String key : videoKeys) {
                String[] parts = key.split("/");
                if (parts.length >= 2) {
                    String courseName = parts[0];
                    courseVideos.computeIfAbsent(courseName, k -> new ArrayList<>()).add(key);
                } else {
                    log.debug("Skipping key at root level (no course folder): {}", key);
                }
            }
            log.info("Courses identified in S3 listing: {}", courseVideos.keySet());
            
            totalCount.set(videoKeys.size());
            currentStatus = "Processing courses and lectures...";
            log.info("Beginning processing of {} videos across courses", videoKeys.size());

            for (Map.Entry<String, List<String>> entry : courseVideos.entrySet()) {
                String courseName = entry.getKey();
                log.info("Processing course: {}", courseName);
                List<String> videos = entry.getValue();

                // Find or create course
                String formattedCourseTitle = formatTitle(courseName);
                String s3Prefix = courseName + "/";
                log.info("Syncing course: {} (Title: {}) with {} videos", courseName, formattedCourseTitle, videos.size());
                
                Course course = courseRepository.findByS3Prefix(s3Prefix)
                        .map(c -> {
                            if (!c.getTitle().equals(formattedCourseTitle)) {
                                c.setTitle(formattedCourseTitle);
                                return courseRepository.save(c);
                            }
                            return c;
                        })
                        .orElseGet(() -> {
                            Course c = Course.builder()
                                    .title(formattedCourseTitle)
                                    .s3Prefix(s3Prefix)
                                    .description("Auto-imported from S3")
                                    .build();
                            return courseRepository.save(c);
                        });

                // Group videos by section (intermediate path segments)
                Map<String, List<String>> sectionVideos = new TreeMap<>();
                for (String videoKey : videos) {
                    String relativePath = videoKey.substring(courseName.length() + 1); // Remove course prefix
                    String[] segments = relativePath.split("/");

                    // Section = all intermediate folders between course and file
                    String sectionPath;
                    if (segments.length == 1) {
                        sectionPath = "_root"; // Files directly under course folder
                    } else {
                        // Join all intermediate segments as the section path
                        sectionPath = String.join("/", Arrays.copyOfRange(segments, 0, segments.length - 1));
                    }
                    sectionVideos.computeIfAbsent(sectionPath, k -> new ArrayList<>()).add(videoKey);
                }

                int sectionCounter = 0;
                for (Map.Entry<String, List<String>> sectionEntry : sectionVideos.entrySet()) {
                    String sectionPath = sectionEntry.getKey();
                    List<String> sectionVideoKeys = sectionEntry.getValue();

                    // Build section title from path segments
                    String sectionTitle;
                    int sectionOrder;
                    if ("_root".equals(sectionPath)) {
                        sectionTitle = "Introduction";
                        sectionOrder = 0;
                    } else {
                        sectionTitle = buildSectionTitle(sectionPath);
                        sectionOrder = extractOrder(sectionPath.split("/")[0], ++sectionCounter);
                    }

                    String fullSectionPath = courseName + "/" + sectionPath;
                    Section section = sectionRepository.findByCourseIdAndS3Path(course.getId(), fullSectionPath)
                            .map(s -> {
                                boolean changed = false;
                                if (!s.getTitle().equals(sectionTitle)) {
                                    s.setTitle(sectionTitle);
                                    changed = true;
                                }
                                if (s.getSortOrder() != sectionOrder) {
                                    s.setSortOrder(sectionOrder);
                                    changed = true;
                                }
                                return changed ? sectionRepository.save(s) : s;
                            })
                            .orElseGet(() -> {
                                Section s = Section.builder()
                                        .title(sectionTitle)
                                        .s3Path(fullSectionPath)
                                        .sortOrder(sectionOrder)
                                        .course(course)
                                        .build();
                                return sectionRepository.save(s);
                            });

                    sectionsCreated++;

                    // Create or update lectures
                    for (String videoKey : sectionVideoKeys) {
                        String fileName = videoKey.substring(videoKey.lastIndexOf("/") + 1);
                        String nameWithoutExt = fileName.replaceFirst("\\.[^.]+$", "");
                        
                        String lectureTitle = formatTitle(extractName(nameWithoutExt));
                        int lectureOrder = extractOrder(nameWithoutExt, 0);

                        lectureRepository.findByS3Key(videoKey)
                            .ifPresentOrElse(
                                l -> {
                                    boolean changed = false;
                                    if (!l.getTitle().equals(lectureTitle)) {
                                        l.setTitle(lectureTitle);
                                        changed = true;
                                    }
                                    if (l.getSortOrder() != lectureOrder) {
                                        l.setSortOrder(lectureOrder);
                                        changed = true;
                                    }
                                    if (changed) lectureRepository.save(l);
                                },
                                () -> {
                                    Lecture l = Lecture.builder()
                                            .title(lectureTitle)
                                            .s3Key(videoKey)
                                            .sortOrder(lectureOrder)
                                            .section(section)
                                            .durationSeconds(0)
                                            .build();
                                    lectureRepository.save(l);
                                }
                            );
                        
                        lecturesCreated++;
                        currentCount.incrementAndGet();
                        if (currentCount.get() % 10 == 0 || currentCount.get() == totalCount.get()) {
                            log.info("Sync progress: {}/{}", currentCount.get(), totalCount.get());
                        }
                    }
                }

                // Update total lectures count
                long totalLectures = videos.size();
                course.setTotalLectures((int) totalLectures);
                courseRepository.save(course);
                coursesCreated++;
            }

            Map<String, Object> result = new HashMap<>();
            result.put("coursesProcessed", coursesCreated);
            result.put("sectionsProcessed", sectionsCreated);
            result.put("lecturesCreated", lecturesCreated);
            result.put("totalVideoFiles", videoKeys.size());

            log.info("S3 scan complete: {}", result);
            currentStatus = "Scan complete";
            return result;
        } finally {
            isScanning = false;
        }
    }

    /**
     * Refresh metadata for all lectures that have 0 or null duration.
     */
    public Map<String, Object> refreshAllMetadata() {
        isScanning = true;
        try {
            log.info("Starting background metadata refresh...");
            List<Lecture> pending = lectureRepository.findAll().stream()
                    .filter(l -> l.getDurationSeconds() == null || l.getDurationSeconds() == 0)
                    .toList();
            
            int total = pending.size();
            totalCount.set(total);
            currentCount.set(0);
            currentStatus = "Refreshing metadata (" + total + " remaining)...";
            
            log.info("Found {} lectures needing metadata refresh", total);
            
            if (total == 0) {
                currentStatus = "No metadata to refresh";
                return Map.of("totalPending", 0, "successfullyUpdated", 0);
            }

            List<CompletableFuture<Boolean>> futures = pending.stream()
                    .map(lecture -> CompletableFuture.supplyAsync(() -> {
                        try {
                            Integer duration = extractDurationFromS3(lecture.getS3Key());
                            if (duration != null && duration > 0) {
                                lecture.setDurationSeconds(duration);
                                lectureRepository.save(lecture);
                                return true;
                            }
                        } catch (Exception e) {
                            log.warn("Failed to refresh metadata for {}: {}", lecture.getS3Key(), e.getMessage());
                        } finally {
                            int current = currentCount.incrementAndGet();
                            currentStatus = String.format("Refreshing metadata (%d/%d)...", current, total);
                        }
                        return false;
                    }, metadataExecutor))
                    .toList();

            CompletableFuture<Void> allOf = CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));
            
            try {
                // Wait for up to 10 minutes
                allOf.get(10, TimeUnit.MINUTES);
            } catch (Exception e) {
                log.warn("Metadata refresh timed out or was interrupted: {}", e.getMessage());
            }

            long updated = futures.stream()
                    .map(f -> f.getNow(false))
                    .filter(b -> b)
                    .count();
            
            Map<String, Object> result = new HashMap<>();
            result.put("totalPending", total);
            result.put("successfullyUpdated", updated);
            log.info("Metadata refresh complete: {}", result);
            currentStatus = "Metadata refresh complete. Updated " + updated + " lectures.";
            return result;
        } finally {
            isScanning = false;
        }
    }

    /**
     * Extracts duration from an MP4 file on S3 by using ffmpeg via a pre-signed URL.
     */
    private Integer extractDurationFromS3(String s3Key) {
        String url = generatePresignedUrl(s3Key);
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    ffmpegPath,
                    "-i", url,
                    "-hide_banner"
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                Pattern durationPattern = Pattern.compile("Duration: (\\d+):(\\d+):(\\d+)");
                while ((line = reader.readLine()) != null) {
                    Matcher m = durationPattern.matcher(line);
                    if (m.find()) {
                        int hours = Integer.parseInt(m.group(1));
                        int minutes = Integer.parseInt(m.group(2));
                        int seconds = Integer.parseInt(m.group(3));
                        return hours * 3600 + minutes * 60 + seconds;
                    }
                }
            }
            process.waitFor(5, TimeUnit.SECONDS);
            if (process.isAlive()) process.destroyForcibly();
            return null;
        } catch (Exception e) {
            log.error("FFmpeg failed for {}: {}", s3Key, e.getMessage());
            return null;
        }
    }

    private boolean isVideoFile(String key) {
        String lower = key.toLowerCase();
        return lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".webm")
                || lower.endsWith(".avi") || lower.endsWith(".mov") || lower.endsWith(".m3u8");
    }

    /**
     * Build a human-readable section title from nested folder path.
     * e.g., "1-Fundamentals/1-Getting-Started" → "Fundamentals > Getting Started"
     */
    private String buildSectionTitle(String sectionPath) {
        String[] parts = sectionPath.split("/");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append(" > ");
            sb.append(formatTitle(extractName(parts[i])));
        }
        return sb.toString();
    }

    /**
     * Extract the name part from an order-name pattern like "1-Getting-Started" → "Getting-Started"
     */
    private String extractName(String input) {
        Matcher m = ORDER_NAME_PATTERN.matcher(input);
        if (m.matches()) {
            return m.group(2);
        }
        return input;
    }

    /**
     * Extract the order number from an order-name pattern like "1-Getting-Started" → 1
     */
    private int extractOrder(String input, int defaultOrder) {
        Matcher m = ORDER_NAME_PATTERN.matcher(input);
        if (m.matches()) {
            return Integer.parseInt(m.group(1));
        }
        return defaultOrder;
    }

    /**
     * Convert kebab-case or dash-separated names to Title Case.
     * e.g., "setting-up-the-development-environment" → "Setting Up The Development Environment"
     */
    private String formatTitle(String input) {
        if (input == null || input.isEmpty()) return input;
        
        // Replace underscores and dashes with spaces
        String spaced = input.replace("-", " ").replace("_", " ");
        
        return Arrays.stream(spaced.split("\\s+"))
                .map(word -> word.isEmpty() ? word :
                        Character.toUpperCase(word.charAt(0)) + word.substring(1).toLowerCase())
                .reduce((a, b) -> a + " " + b)
                .orElse(spaced);
    }
}
