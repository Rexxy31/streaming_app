package com.streamapp.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class CourseDTO {
    private UUID id;
    private String title;
    private String description;
    private String thumbnailUrl;
    private int totalLectures;
    private int completedLectures;
    private double progressPercentage;
    private Integer bestNextLessonIndex;
    private UUID bestNextLectureId;
    private String bestNextLectureTitle;
    private boolean almostFinished;
    private List<SectionDTO> sections;
}
