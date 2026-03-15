package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class LectureHealthDTO {
    private UUID lectureId;
    private String lectureTitle;
    private String sectionTitle;
    private boolean videoPresent;
    private boolean subtitlePresent;
    private String subtitleStatus;
    private Integer durationSeconds;
}
