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
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/learning")
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learningService;

    @GetMapping("/favorites")
    public ResponseEntity<List<UUID>> getFavorites(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.getFavoriteCourseIds(jwt.getSubject()));
    }

    @PutMapping("/favorites/{courseId}")
    public ResponseEntity<Map<String, Object>> updateFavorite(
            @PathVariable UUID courseId,
            @Valid @RequestBody FavoriteCourseUpdateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        List<UUID> favoriteIds = learningService.updateFavoriteCourse(jwt.getSubject(), courseId, dto.getFavorite());
        return ResponseEntity.ok(Map.of("favoriteCourseIds", favoriteIds));
    }

    @GetMapping("/lectures/{lectureId}/notes")
    public ResponseEntity<List<LectureNoteDTO>> getNotes(
            @PathVariable UUID lectureId,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.getNotes(jwt.getSubject(), lectureId));
    }

    @PostMapping("/lectures/{lectureId}/notes")
    public ResponseEntity<LectureNoteDTO> createNote(
            @PathVariable UUID lectureId,
            @Valid @RequestBody LectureNoteCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.createNote(jwt.getSubject(), lectureId, dto));
    }

    @PutMapping("/notes/{noteId}")
    public ResponseEntity<LectureNoteDTO> updateNote(
            @PathVariable UUID noteId,
            @Valid @RequestBody LectureNoteCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.updateNote(jwt.getSubject(), noteId, dto));
    }

    @DeleteMapping("/notes/{noteId}")
    public ResponseEntity<Void> deleteNote(
            @PathVariable UUID noteId,
            @AuthenticationPrincipal Jwt jwt) {
        learningService.deleteNote(jwt.getSubject(), noteId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/lectures/{lectureId}/bookmarks")
    public ResponseEntity<List<LectureBookmarkDTO>> getBookmarks(
            @PathVariable UUID lectureId,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.getBookmarks(jwt.getSubject(), lectureId));
    }

    @PostMapping("/lectures/{lectureId}/bookmarks")
    public ResponseEntity<LectureBookmarkDTO> createBookmark(
            @PathVariable UUID lectureId,
            @Valid @RequestBody LectureBookmarkCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.createBookmark(jwt.getSubject(), lectureId, dto));
    }

    @PutMapping("/bookmarks/{bookmarkId}")
    public ResponseEntity<LectureBookmarkDTO> updateBookmark(
            @PathVariable UUID bookmarkId,
            @Valid @RequestBody LectureBookmarkCreateDTO dto,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.updateBookmark(jwt.getSubject(), bookmarkId, dto));
    }

    @DeleteMapping("/bookmarks/{bookmarkId}")
    public ResponseEntity<Void> deleteBookmark(
            @PathVariable UUID bookmarkId,
            @AuthenticationPrincipal Jwt jwt) {
        learningService.deleteBookmark(jwt.getSubject(), bookmarkId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/recent")
    public ResponseEntity<List<RecentLectureDTO>> getRecent(
            @RequestParam(defaultValue = "12") int limit,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.getRecentLectures(jwt.getSubject(), Math.min(Math.max(limit, 1), 24)));
    }

    @GetMapping("/search")
    public ResponseEntity<CourseSearchResultDTO> searchLessons(
            @RequestParam String q,
            @RequestParam(required = false) UUID courseId,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.searchLessons(jwt.getSubject(), q, courseId));
    }

    @GetMapping("/courses/{courseId}/study-guide")
    public ResponseEntity<StudyGuideDTO> getStudyGuide(
            @PathVariable UUID courseId,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.getStudyGuide(jwt.getSubject(), courseId));
    }

    @GetMapping("/continue-learning")
    public ResponseEntity<ContinueLearningDTO> getContinueLearning(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(learningService.getContinueLearning(jwt.getSubject()));
    }
}
