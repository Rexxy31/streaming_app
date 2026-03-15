package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class ResumeWatchingDTO {
    private UUID courseId;
    private String courseTitle;
    private UUID lectureId;
    private String lectureTitle;
    private int lastPositionSeconds;
    private boolean completed;
    private String recommendationType;
}
