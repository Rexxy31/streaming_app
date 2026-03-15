package com.streamapp.service;

import com.streamapp.dto.AdminHealthSummaryDTO;
import com.streamapp.dto.CourseHealthDTO;
import com.streamapp.dto.LectureHealthDTO;
import com.streamapp.entity.Course;
import com.streamapp.entity.Lecture;
import com.streamapp.entity.Section;
import com.streamapp.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminInsightsService {

    private final CourseRepository courseRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public AdminHealthSummaryDTO getHealthSummary() {
        List<CourseHealthDTO> courses = courseRepository.findAll().stream()
                .map(this::mapCourseHealth)
                .toList();

        return AdminHealthSummaryDTO.builder()
                .totalCourses(courses.size())
                .totalLectures(courses.stream().mapToInt(CourseHealthDTO::getTotalLectures).sum())
                .totalMissingVideos(courses.stream().mapToInt(CourseHealthDTO::getMissingVideoCount).sum())
                .totalMissingSubtitles(courses.stream().mapToInt(CourseHealthDTO::getMissingSubtitleCount).sum())
                .courses(courses)
                .build();
    }

    private CourseHealthDTO mapCourseHealth(Course course) {
        List<LectureHealthDTO> lectureDiagnostics = course.getSections().stream()
                .sorted(Comparator.comparingInt(Section::getSortOrder))
                .flatMap(section -> section.getLectures().stream()
                        .sorted(Comparator.comparingInt(Lecture::getSortOrder)))
                .map(s3Service::buildLectureHealth)
                .toList();

        int lecturesWithVideo = (int) lectureDiagnostics.stream().filter(LectureHealthDTO::isVideoPresent).count();
        int lecturesWithSubtitles = (int) lectureDiagnostics.stream().filter(LectureHealthDTO::isSubtitlePresent).count();
        int missingVideoCount = lectureDiagnostics.size() - lecturesWithVideo;
        int missingSubtitleCount = lectureDiagnostics.size() - lecturesWithSubtitles;

        String status = missingVideoCount == 0 && missingSubtitleCount == 0
                ? "healthy"
                : missingVideoCount > 0
                ? "missing-video"
                : "missing-subtitles";

        return CourseHealthDTO.builder()
                .courseId(course.getId())
                .courseTitle(course.getTitle())
                .totalLectures(lectureDiagnostics.size())
                .lecturesWithVideo(lecturesWithVideo)
                .lecturesWithSubtitles(lecturesWithSubtitles)
                .missingVideoCount(missingVideoCount)
                .missingSubtitleCount(missingSubtitleCount)
                .status(status)
                .lectureDiagnostics(lectureDiagnostics)
                .build();
    }
}
