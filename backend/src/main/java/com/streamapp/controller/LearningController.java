package com.streamapp.controller;

import com.streamapp.dto.*;
import com.streamapp.service.LearningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/learning")
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learningService;

    @GetMapping("/favorites")
    public List<UUID> getFavoriteCourseIds(@AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.getFavoriteCourseIds(userId);
    }

    @PostMapping("/favorites/{courseId}")
    public List<UUID> updateFavoriteCourse(
            @PathVariable UUID courseId,
            @RequestParam boolean favorite,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.updateFavoriteCourse(userId, Objects.requireNonNull(courseId), favorite);
    }

    @GetMapping("/notes/{lectureId}")
    public List<LectureNoteDTO> getNotes(
            @PathVariable UUID lectureId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.getNotes(userId, Objects.requireNonNull(lectureId));
    }

    @PostMapping("/notes/{lectureId}")
    public LectureNoteDTO createNote(
            @PathVariable UUID lectureId,
            @Valid @RequestBody LectureNoteCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.createNote(userId, Objects.requireNonNull(lectureId), Objects.requireNonNull(dto));
    }

    @PutMapping("/notes/{noteId}")
    public LectureNoteDTO updateNote(
            @PathVariable UUID noteId,
            @Valid @RequestBody LectureNoteCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.updateNote(userId, Objects.requireNonNull(noteId), Objects.requireNonNull(dto));
    }

    @DeleteMapping("/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        learningService.deleteNote(userId, Objects.requireNonNull(noteId));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/bookmarks/{lectureId}")
    public List<LectureBookmarkDTO> getBookmarks(
            @PathVariable UUID lectureId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.getBookmarks(userId, Objects.requireNonNull(lectureId));
    }

    @PostMapping("/bookmarks/{lectureId}")
    public LectureBookmarkDTO createBookmark(
            @PathVariable UUID lectureId,
            @Valid @RequestBody LectureBookmarkCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.createBookmark(userId, Objects.requireNonNull(lectureId), Objects.requireNonNull(dto));
    }

    @PutMapping("/bookmarks/{bookmarkId}")
    public LectureBookmarkDTO updateBookmark(
            @PathVariable UUID bookmarkId,
            @Valid @RequestBody LectureBookmarkCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.updateBookmark(userId, Objects.requireNonNull(bookmarkId), Objects.requireNonNull(dto));
    }

    @DeleteMapping("/bookmarks/{bookmarkId}")
    public ResponseEntity<Void> deleteBookmark(
            @PathVariable UUID bookmarkId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        learningService.deleteBookmark(userId, Objects.requireNonNull(bookmarkId));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search")
    public CourseSearchResultDTO searchLessons(
            @RequestParam String query,
            @RequestParam(required = false) UUID courseId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.searchLessons(userId, query, courseId);
    }

    @GetMapping("/study-guide/{courseId}")
    public StudyGuideDTO getStudyGuide(
            @PathVariable UUID courseId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.getStudyGuide(userId, Objects.requireNonNull(courseId));
    }

    @GetMapping("/continue")
    public ContinueLearningDTO getContinueLearning(@AuthenticationPrincipal Jwt jwt) {
        String userId = Objects.requireNonNull(jwt.getSubject(), "User ID from JWT must not be null");
        return learningService.getContinueLearning(userId);
    }
}
