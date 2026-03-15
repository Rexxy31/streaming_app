package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AdminHealthSummaryDTO {
    private int totalCourses;
    private int totalLectures;
    private int totalMissingVideos;
    private int totalMissingSubtitles;
    private List<CourseHealthDTO> courses;
}
