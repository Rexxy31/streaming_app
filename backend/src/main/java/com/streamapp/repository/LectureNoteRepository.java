package com.streamapp.repository;

import com.streamapp.entity.LectureNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LectureNoteRepository extends JpaRepository<LectureNote, UUID> {
    List<LectureNote> findByUserIdAndLecture_IdOrderByCreatedAtDesc(String userId, UUID lectureId);
    List<LectureNote> findByUserIdAndLecture_Section_Course_IdOrderByCreatedAtDesc(String userId, UUID courseId);
    java.util.Optional<LectureNote> findByIdAndUserId(UUID id, String userId);
}
