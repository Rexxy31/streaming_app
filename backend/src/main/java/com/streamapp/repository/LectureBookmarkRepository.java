package com.streamapp.repository;

import com.streamapp.entity.LectureBookmark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LectureBookmarkRepository extends JpaRepository<LectureBookmark, UUID> {
    List<LectureBookmark> findByUserIdAndLecture_IdOrderByCreatedAtDesc(String userId, UUID lectureId);
    List<LectureBookmark> findByUserIdAndLecture_Section_Course_IdOrderByCreatedAtDesc(String userId, UUID courseId);
    java.util.Optional<LectureBookmark> findByIdAndUserId(UUID id, String userId);
}
