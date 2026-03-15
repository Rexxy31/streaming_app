package com.streamapp.controller;

import com.streamapp.dto.CourseDTO;
import com.streamapp.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ResponseEntity<List<CourseDTO>> getAllCourses(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(courseService.getAllCourses(userId));
    }

    @GetMapping("/resume")
    public ResponseEntity<?> getResumeWatching(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return courseService.getResumeWatching(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CourseDTO> getCourseById(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(courseService.getCourseById(id, userId));
    }
}
