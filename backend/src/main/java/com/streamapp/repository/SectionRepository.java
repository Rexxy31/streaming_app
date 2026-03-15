package com.streamapp.repository;

import com.streamapp.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SectionRepository extends JpaRepository<Section, UUID> {
    Optional<Section> findByCourseIdAndS3Path(UUID courseId, String s3Path);
}
