package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ContinueLearningItemDTO {
    private String label;
    private UUID courseId;
    private String courseTitle;
    private UUID lectureId;
    private String lectureTitle;
    private int progressSeconds;
    private double progressPercentage;
    private boolean completed;
}
