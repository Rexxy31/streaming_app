package com.streamapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDTO {
    private List<CourseDTO> courses;
    private List<RecentLectureDTO> recentLectures;
    private Set<String> favoriteCourseIds;
    private ContinueLearningDTO continueLearning;
}
