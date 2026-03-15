package com.streamapp.repository;

import com.streamapp.entity.Lecture;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LectureRepository extends JpaRepository<Lecture, UUID> {
    Optional<Lecture> findByS3Key(String s3Key);
}
