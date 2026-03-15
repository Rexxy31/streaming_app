package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class StudyGuideItemDTO {
    private String type;
    private UUID lectureId;
    private String lectureTitle;
    private String sectionTitle;
    private int timeSeconds;
    private String primaryText;
    private String secondaryText;
    private List<String> tags;
    private String highlightColor;
    private LocalDateTime createdAt;
}
