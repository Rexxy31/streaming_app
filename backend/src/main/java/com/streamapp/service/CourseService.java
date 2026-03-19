package com.streamapp.service;

import com.streamapp.dto.*;
import com.streamapp.entity.*;
import com.streamapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;
    private final WatchProgressRepository watchProgressRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public List<CourseDTO> getAllCourses(String userId) {
        List<Course> courses = courseRepository.findAll();
        return courses.stream()
                .map(course -> mapToCourseDTO(course, userId, false))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<ResumeWatchingDTO> getResumeWatching(String userId) {
        return watchProgressRepository.findTop12ByUserIdOrderByUpdatedAtDesc(userId).stream()
                .filter(wp -> !wp.isCompleted() && wp.getLastPositionSeconds() > 0)
                .findFirst()
                .or(() -> watchProgressRepository.findFirstByUserIdOrderByUpdatedAtDesc(userId))
                .map(wp -> {
                    Lecture lecture = wp.getLecture();
                    Course course = lecture.getSection().getCourse();
                    String recommendationType = wp.isCompleted() ? "recent" : "pick-up-where-you-left-off";
                    return ResumeWatchingDTO.builder()
                            .courseId(course.getId())
                            .courseTitle(course.getTitle())
                            .lectureId(lecture.getId())
                            .lectureTitle(lecture.getTitle())
                            .lastPositionSeconds(wp.getLastPositionSeconds())
                            .completed(wp.isCompleted())
                            .recommendationType(recommendationType)
                            .build();
                });
    }

    @Transactional(readOnly = true)
    public CourseDTO getCourseById(@NonNull UUID courseId, String userId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NoSuchElementException("Course not found: " + courseId));
        return mapToCourseDTO(course, userId, true);
    }

    private CourseDTO mapToCourseDTO(Course course, String userId, boolean includeSections) {
        long completed = watchProgressRepository.countCompletedByUserIdAndCourseId(userId, course.getId());
        int total = course.getTotalLectures();
        double progress = total > 0 ? (completed * 100.0 / total) : 0;

        CourseDTO.CourseDTOBuilder builder = CourseDTO.builder()
                .id(course.getId())
                .title(course.getTitle())
                .description(course.getDescription())
                .thumbnailUrl(course.getThumbnailUrl())
                .totalLectures(total)
                .completedLectures((int) completed)
                .progressPercentage(Math.round(progress * 10.0) / 10.0)
                .almostFinished(total > 0 && completed >= Math.max(1, total - 2));

        List<LectureWithProgress> orderedLectures = course.getSections().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingInt(Section::getSortOrder))
                .flatMap(section -> {
                    List<Lecture> lectures = section.getLectures();
                    if (lectures == null) return Stream.empty();
                    return lectures.stream()
                            .filter(Objects::nonNull)
                            .sorted(Comparator.comparingInt(Lecture::getSortOrder))
                            .map(lecture -> new LectureWithProgress(Objects.requireNonNull(lecture), null));
                })
                .toList();

        Optional<LectureWithProgress> bestNextLecture = findBestNextLecture(orderedLectures, userId);
        bestNextLecture.ifPresent(next -> builder
                .bestNextLessonIndex(orderedLectures.indexOf(next) + 1)
                .bestNextLectureId(next.lecture().getId())
                .bestNextLectureTitle(next.lecture().getTitle()));

        if (includeSections) {
            // Get all progress for this course at once
            Map<UUID, WatchProgress> progressMap = watchProgressRepository
                    .findByUserIdAndCourseId(userId, course.getId())
                    .stream()
                    .filter(wp -> wp.getLecture() != null && wp.getLecture().getId() != null)
                    .collect(Collectors.toMap(wp -> wp.getLecture().getId(), wp -> wp));

            List<LectureWithProgress> lecturesWithProgress = course.getSections().stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparingInt(Section::getSortOrder))
                    .flatMap(section -> {
                        List<Lecture> lectures = section.getLectures();
                        if (lectures == null) return Stream.empty();
                        return lectures.stream()
                                .filter(Objects::nonNull)
                                .sorted(Comparator.comparingInt(Lecture::getSortOrder))
                                .map(lecture -> new LectureWithProgress(Objects.requireNonNull(lecture), progressMap.get(lecture.getId())));
                    })
                    .toList();

            findBestNextLecture(lecturesWithProgress, userId).ifPresent(next -> builder
                    .bestNextLessonIndex(lecturesWithProgress.indexOf(next) + 1)
                    .bestNextLectureId(next.lecture().getId())
                    .bestNextLectureTitle(next.lecture().getTitle()));

            List<SectionDTO> sectionDTOs = course.getSections().stream()
                    .filter(Objects::nonNull)
                    .map(section -> mapToSectionDTO(section, progressMap))
                    .collect(Collectors.toList());
            builder.sections(sectionDTOs);
        }

        return builder.build();
    }

    private SectionDTO mapToSectionDTO(Section section, Map<UUID, WatchProgress> progressMap) {
        List<LectureDTO> lectureDTOs = section.getLectures().stream()
                .filter(Objects::nonNull)
                .map(lecture -> {
                    WatchProgress wp = progressMap.get(lecture.getId());
                    return LectureDTO.builder()
                            .id(lecture.getId())
                            .title(lecture.getTitle())
                            .sortOrder(lecture.getSortOrder())
                            .durationSeconds(lecture.getDurationSeconds())
                            .subtitleStatus(s3Service.getSubtitleStatus(lecture.getS3Key()))
                            .hasSubtitle("available".equals(s3Service.getSubtitleStatus(lecture.getS3Key())))
                            .completed(wp != null && wp.isCompleted())
                            .lastPositionSeconds(wp != null ? wp.getLastPositionSeconds() : 0)
                            .build();
                })
                .collect(Collectors.toList());

        return SectionDTO.builder()
                .id(section.getId())
                .title(section.getTitle())
                .sortOrder(section.getSortOrder())
                .lectures(lectureDTOs)
                .build();
    }

    private Optional<LectureWithProgress> findBestNextLecture(List<LectureWithProgress> lectures, String userId) {
        return lectures.stream()
                .filter(item -> item.progress() != null && item.progress().getLastPositionSeconds() > 0 && !item.progress().isCompleted())
                .findFirst()
                .or(() -> lectures.stream().filter(item -> item.progress() == null || !item.progress().isCompleted()).findFirst());
    }

    private record LectureWithProgress(@NonNull Lecture lecture, WatchProgress progress) {
    }
}
