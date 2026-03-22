package com.streamapp.controller;

import com.streamapp.entity.Lecture;
import com.streamapp.repository.LectureRepository;
import com.streamapp.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/lectures")
@RequiredArgsConstructor
public class LectureController {

    private final LectureRepository lectureRepository;
    private final S3Service s3Service;

    @GetMapping("/{lectureId}/stream-url")
    public ResponseEntity<java.util.Map<String, Object>> getStreamUrl(@PathVariable @NonNull UUID lectureId) {
        String s3Key = lectureRepository.findById(lectureId)
                .map(Lecture::getS3Key)
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + lectureId));

        String presignedUrl = s3Service.generatePresignedUrl(s3Key);
        return ResponseEntity.ok(java.util.Map.of(
                "url", presignedUrl,
                "expiresInMinutes", 60
        ));
    }

    @GetMapping("/{lectureId}/subtitles")
    public ResponseEntity<Resource> getSubtitle(@PathVariable @NonNull UUID lectureId) {
        String s3Key = lectureRepository.findById(lectureId)
                .map(Lecture::getS3Key)
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + lectureId));

        return s3Service.findSubtitleKey(s3Key)
                .map(subtitleKey -> {
                    String vttContent = s3Service.loadSubtitleAsWebVtt(subtitleKey);
                    ByteArrayResource resource = new ByteArrayResource(
                            Objects.requireNonNull(vttContent.getBytes(StandardCharsets.UTF_8)));
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType("text/vtt"))
                            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"subtitle.vtt\"")
                            .body((Resource) resource);
                })
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/{lectureId}/duration")
    public ResponseEntity<Void> updateDuration(
            @PathVariable @NonNull UUID lectureId,
            @RequestParam Integer durationSeconds) {
        lectureRepository.findById(lectureId).ifPresent(lecture -> {
            lecture.setDurationSeconds(Objects.requireNonNull(durationSeconds));
            lectureRepository.save(lecture);
        });
        return ResponseEntity.ok().build();
    }
}
