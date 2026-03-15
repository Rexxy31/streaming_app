package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CourseHealthDTO {
    private UUID courseId;
    private String courseTitle;
    private int totalLectures;
    private int lecturesWithVideo;
    private int lecturesWithSubtitles;
    private int missingVideoCount;
    private int missingSubtitleCount;
    private String status;
    private List<LectureHealthDTO> lectureDiagnostics;
}
