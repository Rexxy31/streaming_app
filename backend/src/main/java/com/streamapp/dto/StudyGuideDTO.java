package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class StudyGuideDTO {
    private UUID courseId;
    private String courseTitle;
    private int totalNotes;
    private int totalBookmarks;
    private List<StudyGuideItemDTO> items;
}
