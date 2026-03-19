package com.streamapp.controller;

import com.streamapp.dto.CourseDTO;
import com.streamapp.dto.ResumeWatchingDTO;
import com.streamapp.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public List<CourseDTO> getAllCourses(@AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return courseService.getAllCourses(userId);
    }

    @GetMapping("/resume")
    public Optional<ResumeWatchingDTO> getResumeWatching(@AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return courseService.getResumeWatching(userId);
    }

    @GetMapping("/{courseId}")
    public CourseDTO getCourseById(@PathVariable UUID courseId, @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return courseService.getCourseById(Objects.requireNonNull(courseId), userId);
    }
}
