package com.streamapp.controller;

import com.streamapp.dto.SyncProgressDTO;
import com.streamapp.dto.AdminHealthSummaryDTO;
import com.streamapp.service.AdminInsightsService;
import com.streamapp.service.S3Service;
import com.streamapp.service.TranscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final S3Service s3Service;
    private final AdminInsightsService adminInsightsService;
    private final TranscriptionService transcriptionService;

    /**
     * Scan S3 bucket and sync all courses/sections/lectures into the database.
     * POST /api/admin/scan-s3
     */
    @PostMapping("/scan-s3")
    public ResponseEntity<Map<String, String>> scanS3() {
        if (s3Service.getCurrentProgress().isActive()) {
            return ResponseEntity.status(409).body(Map.of("message", "Scan already in progress"));
        }
        s3Service.markScanActive("Starting scan...");
        s3Service.scanAndSyncAsync();
        return ResponseEntity.ok(Map.of("message", "Scan started"));
    }

    /**
     * Trigger a background refresh of video metadata (durations) for all lectures.
     * POST /api/admin/refresh-metadata
     */
    @PostMapping("/refresh-metadata")
    public ResponseEntity<Map<String, String>> refreshMetadata() {
        if (s3Service.getCurrentProgress().isActive()) {
            return ResponseEntity.status(409).body(Map.of("message", "Scan already in progress"));
        }
        s3Service.markScanActive("Starting metadata refresh...");
        s3Service.refreshAllMetadataAsync();
        return ResponseEntity.ok(Map.of("message", "Metadata refresh started"));
    }

    /**
     * Get the current status of the background scan/sync process.
     * GET /api/admin/scan-status
     */
    @GetMapping("/scan-status")
    public ResponseEntity<SyncProgressDTO> getScanStatus() {
        return ResponseEntity.ok(s3Service.getCurrentProgress());
    }

    @GetMapping("/course-health")
    public ResponseEntity<AdminHealthSummaryDTO> getCourseHealth() {
        return ResponseEntity.ok(adminInsightsService.getHealthSummary());
    }

    /**
     * Generate subtitles for all lectures missing them using local Whisper.
     * POST /api/admin/generate-subtitles?courseId=xxx (optional)
     */
    @PostMapping("/generate-subtitles")
    public ResponseEntity<Map<String, String>> generateSubtitles(
            @RequestParam(required = false) UUID courseId) {
        if (s3Service.getCurrentProgress().isActive()) {
            return ResponseEntity.status(409).body(Map.of("message", "Another operation is already in progress"));
        }
        transcriptionService.generateSubtitlesAsync(courseId);
        return ResponseEntity.ok(Map.of("message", "Subtitle generation started"));
    }

    /**
     * Health check endpoint (public, no auth needed).
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }
}
