package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class RecentLectureDTO {
    private UUID courseId;
    private String courseTitle;
    private UUID lectureId;
    private String lectureTitle;
    private String sectionTitle;
    private LocalDateTime updatedAt;
    private int progressSeconds;
    private boolean completed;
    private double progressPercentage;
}
