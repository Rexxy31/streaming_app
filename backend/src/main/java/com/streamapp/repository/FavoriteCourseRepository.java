package com.streamapp.repository;

import com.streamapp.entity.FavoriteCourse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FavoriteCourseRepository extends JpaRepository<FavoriteCourse, UUID> {
    List<FavoriteCourse> findByUserId(String userId);
    Optional<FavoriteCourse> findByUserIdAndCourse_Id(String userId, UUID courseId);
}
