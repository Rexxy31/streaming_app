package com.streamapp.controller;

import com.streamapp.dto.ProgressUpdateDTO;
import com.streamapp.entity.WatchProgress;
import com.streamapp.service.ProgressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
public class ProgressController {

    private final ProgressService progressService;

    @PutMapping
    public ResponseEntity<Map<String, Object>> updateProgress(
            @Valid @RequestBody ProgressUpdateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        WatchProgress wp = progressService.updateProgress(userId, dto);
        return ResponseEntity.ok(Map.of(
                "lectureId", wp.getLecture().getId(),
                "lastPositionSeconds", wp.getLastPositionSeconds(),
                "completed", wp.isCompleted()
        ));
    }

    @GetMapping("/{lectureId}")
    public ResponseEntity<Map<String, Object>> getProgress(
            @PathVariable UUID lectureId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        WatchProgress wp = progressService.getProgress(userId, lectureId);
        return ResponseEntity.ok(Map.of(
                "lastPositionSeconds", wp.getLastPositionSeconds(),
                "completed", wp.isCompleted()
        ));
    }
}
