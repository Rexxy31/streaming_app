package com.streamapp.repository;

import com.streamapp.entity.WatchProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WatchProgressRepository extends JpaRepository<WatchProgress, UUID> {

    Optional<WatchProgress> findByUserIdAndLectureId(String userId, UUID lectureId);

    List<WatchProgress> findByUserId(String userId);

    @Query("SELECT wp FROM WatchProgress wp WHERE wp.userId = :userId AND wp.lecture.section.course.id = :courseId")
    List<WatchProgress> findByUserIdAndCourseId(String userId, UUID courseId);

    @Query("SELECT COUNT(wp) FROM WatchProgress wp WHERE wp.userId = :userId AND wp.completed = true AND wp.lecture.section.course.id = :courseId")
    long countCompletedByUserIdAndCourseId(String userId, UUID courseId);

    Optional<WatchProgress> findFirstByUserIdOrderByUpdatedAtDesc(String userId);

    List<WatchProgress> findTop12ByUserIdOrderByUpdatedAtDesc(String userId);
}
