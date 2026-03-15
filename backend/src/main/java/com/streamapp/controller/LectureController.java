package com.streamapp.controller;

import com.streamapp.dto.StreamUrlDTO;
import com.streamapp.entity.Lecture;
import com.streamapp.repository.LectureRepository;
import com.streamapp.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequestMapping("/api/lectures")
@RequiredArgsConstructor
public class LectureController {

    private final LectureRepository lectureRepository;
    private final S3Service s3Service;

    @Value("${aws.s3.presigned-url-expiration-minutes}")
    private int expirationMinutes;

    @GetMapping("/{id}/stream-url")
    public ResponseEntity<StreamUrlDTO> getStreamUrl(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        Lecture lecture = lectureRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + id));

        String url = s3Service.generatePresignedUrl(lecture.getS3Key());
        String subtitleKey = s3Service.findSubtitleKey(lecture.getS3Key()).orElse(null);
        return ResponseEntity.ok(StreamUrlDTO.builder()
                .url(url)
                .subtitleUrl(subtitleKey != null ? s3Service.generatePresignedUrl(subtitleKey) : null)
                .subtitleFormat(subtitleKey != null ? subtitleKey.substring(subtitleKey.lastIndexOf('.') + 1).toLowerCase() : null)
                .expiresInMinutes(expirationMinutes)
                .build());
    }

    @GetMapping("/{id}/subtitle")
    public ResponseEntity<String> getSubtitle(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        Lecture lecture = lectureRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + id));

        return s3Service.findSubtitleKey(lecture.getS3Key())
                .map(subtitleKey -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_TYPE, "text/vtt; charset=utf-8")
                        .body(s3Service.loadSubtitleAsWebVtt(subtitleKey)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/{id}/duration")
    public ResponseEntity<Void> updateDuration(
            @PathVariable UUID id,
            @RequestBody Integer durationSeconds) {
        Lecture lecture = lectureRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + id));

        if (lecture.getDurationSeconds() == null || lecture.getDurationSeconds() == 0) {
            lecture.setDurationSeconds(durationSeconds);
            lectureRepository.save(lecture);
        }
        return ResponseEntity.ok().build();
    }
}
