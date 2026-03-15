package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CourseSearchResultDTO {
    private String query;
    private List<LessonSearchResultDTO> lessons;
}
