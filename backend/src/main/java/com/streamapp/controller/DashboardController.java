package com.streamapp.controller;

import com.streamapp.dto.DashboardDTO;
import com.streamapp.service.LearningService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/api/learning/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final LearningService learningService;

    @GetMapping
    public DashboardDTO getDashboard(@AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.getDashboardData(userId);
    }
}
