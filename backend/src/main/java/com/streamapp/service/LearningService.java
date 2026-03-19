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

@Service
@RequiredArgsConstructor
public class LearningService {

    private final FavoriteCourseRepository favoriteCourseRepository;
    private final LectureNoteRepository lectureNoteRepository;
    private final LectureBookmarkRepository lectureBookmarkRepository;
    private final WatchProgressRepository watchProgressRepository;
    private final CourseRepository courseRepository;
    private final LectureRepository lectureRepository;
    private final S3Service s3Service;
    private final CourseService courseService;

    @org.springframework.cache.annotation.Cacheable(value = "dashboard", key = "#userId")
    @Transactional(readOnly = true)
    public DashboardDTO getDashboardData(@NonNull String userId) {
        return DashboardDTO.builder()
                .courses(courseService.getAllCourses(userId))
                .recentLectures(getRecentLectures(userId, 12))
                .favoriteCourseIds(getFavoriteCourseIds(userId).stream()
                        .map(Optional::ofNullable)
                        .flatMap(Optional::stream)
                        .map(UUID::toString)
                        .collect(Collectors.toSet()))
                .continueLearning(getContinueLearning(userId))
                .build();
    }

    @Transactional(readOnly = true)
    public List<UUID> getFavoriteCourseIds(@NonNull String userId) {
        return favoriteCourseRepository.findByUserId(userId).stream()
                .map(it -> Optional.ofNullable(it.getCourse()))
                .flatMap(Optional::stream)
                .map(it -> Optional.ofNullable(it.getId()))
                .flatMap(Optional::stream)
                .toList();
    }

    @Transactional
    public List<UUID> updateFavoriteCourse(@NonNull String userId, @NonNull UUID courseId, boolean favorite) {
        if (favorite) {
            Course course = courseRepository.findById(courseId)
                    .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

            favoriteCourseRepository.findByUserIdAndCourse_Id(userId, courseId)
                    .orElseGet(() -> favoriteCourseRepository.save(FavoriteCourse.builder()
                            .userId(userId)
                            .course(course)
                            .build()));
        } else {
            favoriteCourseRepository.findByUserIdAndCourse_Id(userId, courseId)
                    .ifPresent(favoriteCourseRepository::delete);
        }

        return getFavoriteCourseIds(userId);
    }

    @Transactional(readOnly = true)
    public List<LectureNoteDTO> getNotes(@NonNull String userId, @NonNull UUID lectureId) {
        return lectureNoteRepository.findByUserIdAndLecture_IdOrderByCreatedAtDesc(userId, lectureId).stream()
                .filter(Objects::nonNull)
                .map(this::mapNote)
                .toList();
    }

    @Transactional
    public LectureNoteDTO createNote(@NonNull String userId, @NonNull UUID lectureId, @NonNull LectureNoteCreateDTO dto) {
        Lecture lecture = lectureRepository.findById(lectureId)
                .orElseThrow(() -> new IllegalArgumentException("Lecture not found: " + lectureId));

        LectureNote note = lectureNoteRepository.save(LectureNote.builder()
                .userId(userId)
                .lecture(lecture)
                .timeSeconds(dto.getTimeSeconds())
                .text(Objects.requireNonNull(dto.getText()).trim())
                .tags(serializeTags(dto.getTags()))
                .highlightColor(normalizeColor(dto.getHighlightColor()))
                .build());

        return mapNote(note);
    }

    @Transactional
    public LectureNoteDTO updateNote(@NonNull String userId, @NonNull UUID noteId, @NonNull LectureNoteCreateDTO dto) {
        LectureNote note = lectureNoteRepository.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new NoSuchElementException("Note not found: " + noteId));

        note.setTimeSeconds(dto.getTimeSeconds());
        note.setText(Objects.requireNonNull(dto.getText()).trim());
        note.setTags(serializeTags(dto.getTags()));
        note.setHighlightColor(normalizeColor(dto.getHighlightColor()));
        LectureNote saved = lectureNoteRepository.save(note);
        return mapNote(saved);
    }

    @Transactional
    public void deleteNote(@NonNull String userId, @NonNull UUID noteId) {
        LectureNote note = lectureNoteRepository.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new NoSuchElementException("Note not found: " + noteId));
        lectureNoteRepository.delete(note);
    }

    @Transactional(readOnly = true)
    public List<LectureBookmarkDTO> getBookmarks(@NonNull String userId, @NonNull UUID lectureId) {
        return lectureBookmarkRepository.findByUserIdAndLecture_IdOrderByCreatedAtDesc(userId, lectureId).stream()
                .filter(Objects::nonNull)
                .map(this::mapBookmark)
                .toList();
    }

    @Transactional
    public LectureBookmarkDTO createBookmark(@NonNull String userId, @NonNull UUID lectureId, @NonNull LectureBookmarkCreateDTO dto) {
        Lecture lecture = lectureRepository.findById(lectureId)
                .orElseThrow(() -> new IllegalArgumentException("Lecture not found: " + lectureId));

        LectureBookmark bookmark = lectureBookmarkRepository.save(LectureBookmark.builder()
                .userId(userId)
                .lecture(lecture)
                .timeSeconds(dto.getTimeSeconds())
                .label(Objects.requireNonNull(dto.getLabel()).trim())
                .tags(serializeTags(dto.getTags()))
                .highlightColor(normalizeColor(dto.getHighlightColor()))
                .build());

        return mapBookmark(bookmark);
    }

    @Transactional
    public LectureBookmarkDTO updateBookmark(@NonNull String userId, @NonNull UUID bookmarkId, @NonNull LectureBookmarkCreateDTO dto) {
        LectureBookmark bookmark = lectureBookmarkRepository.findByIdAndUserId(bookmarkId, userId)
                .orElseThrow(() -> new NoSuchElementException("Bookmark not found: " + bookmarkId));

        bookmark.setTimeSeconds(dto.getTimeSeconds());
        bookmark.setLabel(Objects.requireNonNull(dto.getLabel()).trim());
        bookmark.setTags(serializeTags(dto.getTags()));
        bookmark.setHighlightColor(normalizeColor(dto.getHighlightColor()));
        LectureBookmark saved = lectureBookmarkRepository.save(bookmark);
        return mapBookmark(saved);
    }

    @Transactional
    public void deleteBookmark(@NonNull String userId, @NonNull UUID bookmarkId) {
        LectureBookmark bookmark = lectureBookmarkRepository.findByIdAndUserId(bookmarkId, userId)
                .orElseThrow(() -> new NoSuchElementException("Bookmark not found: " + bookmarkId));
        lectureBookmarkRepository.delete(bookmark);
    }

    @Transactional(readOnly = true)
    public List<RecentLectureDTO> getRecentLectures(@NonNull String userId, int limit) {
        return watchProgressRepository.findTop12ByUserIdOrderByUpdatedAtDesc(userId).stream()
                .filter(Objects::nonNull)
                .limit(limit)
                .map(progress -> {
                    Lecture lecture = progress.getLecture();
                    Section section = lecture.getSection();
                    Course course = section.getCourse();
                    double progressPercentage = lecture.getDurationSeconds() != null && lecture.getDurationSeconds() > 0
                            ? Math.min(100.0, (progress.getLastPositionSeconds() * 100.0) / lecture.getDurationSeconds())
                            : 0;
                    return RecentLectureDTO.builder()
                            .courseId(course.getId())
                            .courseTitle(course.getTitle())
                            .lectureId(lecture.getId())
                            .lectureTitle(lecture.getTitle())
                            .sectionTitle(section.getTitle())
                            .updatedAt(progress.getUpdatedAt())
                            .progressSeconds(progress.getLastPositionSeconds())
                            .completed(progress.isCompleted())
                            .progressPercentage(Math.round(progressPercentage * 10.0) / 10.0)
                            .build();
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public CourseSearchResultDTO searchLessons(@NonNull String userId, String query, UUID courseId) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        if (normalizedQuery.isBlank()) {
            return CourseSearchResultDTO.builder()
                    .query("")
                    .lessons(List.of())
                    .build();
        }

        List<Course> courses = courseId == null
                ? courseRepository.findAll()
                : List.of(courseRepository.findById(courseId)
                .orElseThrow(() -> new NoSuchElementException("Course not found: " + courseId)));

        Map<UUID, WatchProgress> progressByLecture = watchProgressRepository.findByUserId(userId).stream()
                .filter(p -> p.getLecture() != null && p.getLecture().getId() != null)
                .collect(Collectors.toMap(p -> p.getLecture().getId(), p -> p, (a, b) -> a));

        List<LessonSearchResultDTO> lessons = courses.stream()
                .filter(Objects::nonNull)
                .flatMap(course -> course.getSections().stream()
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparingInt(Section::getSortOrder))
                        .flatMap(section -> section.getLectures().stream()
                                .filter(Objects::nonNull)
                                .sorted(Comparator.comparingInt(Lecture::getSortOrder))
                                .map(lecture -> mapSearchResult(course, section, lecture, progressByLecture.get(lecture.getId()), normalizedQuery))))
                .filter(Objects::nonNull)
                .limit(40)
                .toList();

        return CourseSearchResultDTO.builder()
                .query(normalizedQuery)
                .lessons(lessons)
                .build();
    }

    @Transactional(readOnly = true)
    public StudyGuideDTO getStudyGuide(@NonNull String userId, @NonNull UUID courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new NoSuchElementException("Course not found: " + courseId));

        List<StudyGuideItemDTO> items = new ArrayList<>();

        lectureNoteRepository.findByUserIdAndLecture_Section_Course_IdOrderByCreatedAtDesc(userId, courseId)
                .forEach(note -> items.add(StudyGuideItemDTO.builder()
                        .type("note")
                        .lectureId(note.getLecture().getId())
                        .lectureTitle(note.getLecture().getTitle())
                        .sectionTitle(note.getLecture().getSection().getTitle())
                        .timeSeconds(note.getTimeSeconds())
                        .primaryText(note.getText())
                        .secondaryText("Personal note")
                        .tags(parseTags(note.getTags()))
                        .highlightColor(note.getHighlightColor())
                        .createdAt(note.getCreatedAt())
                        .build()));

        lectureBookmarkRepository.findByUserIdAndLecture_Section_Course_IdOrderByCreatedAtDesc(userId, courseId)
                .forEach(bookmark -> items.add(StudyGuideItemDTO.builder()
                        .type("bookmark")
                        .lectureId(bookmark.getLecture().getId())
                        .lectureTitle(bookmark.getLecture().getTitle())
                        .sectionTitle(bookmark.getLecture().getSection().getTitle())
                        .timeSeconds(bookmark.getTimeSeconds())
                        .primaryText(bookmark.getLabel())
                        .secondaryText("Saved moment")
                        .tags(parseTags(bookmark.getTags()))
                        .highlightColor(bookmark.getHighlightColor())
                        .createdAt(bookmark.getCreatedAt())
                        .build()));

        items.sort(Comparator.comparing(StudyGuideItemDTO::getCreatedAt).reversed());

        return StudyGuideDTO.builder()
                .courseId(course.getId())
                .courseTitle(course.getTitle())
                .totalNotes((int) items.stream().filter(item -> "note".equals(item.getType())).count())
                .totalBookmarks((int) items.stream().filter(item -> "bookmark".equals(item.getType())).count())
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public ContinueLearningDTO getContinueLearning(@NonNull String userId) {
        List<WatchProgress> recentProgress = watchProgressRepository.findTop12ByUserIdOrderByUpdatedAtDesc(userId);
        Set<UUID> favoriteCourseIds = new HashSet<>(getFavoriteCourseIds(userId));

        ContinueLearningItemDTO pickup = recentProgress.stream()
                .filter(progress -> !progress.isCompleted() && progress.getLastPositionSeconds() > 0)
                .findFirst()
                .map(progress -> mapContinueLearningItem("Pick up where you left off", progress))
                .orElse(null);

        ContinueLearningItemDTO almostFinished = recentProgress.stream()
                .filter(progress -> !progress.isCompleted())
                .filter(progress -> calculateProgressPercent(progress) >= 80)
                .max(Comparator.comparingDouble(this::calculateProgressPercent))
                .map(progress -> mapContinueLearningItem("Almost finished", progress))
                .orElse(null);

        Map<UUID, WatchProgress> mostRecentPerCourse = recentProgress.stream()
                .collect(Collectors.toMap(
                        progress -> progress.getLecture().getSection().getCourse().getId(),
                        progress -> progress,
                        (left, right) -> left.getUpdatedAt().isAfter(right.getUpdatedAt()) ? left : right,
                        LinkedHashMap::new
                ));

        List<ContinueLearningItemDTO> bestNextLessons = courseRepository.findAll().stream()
                .sorted(Comparator
                        .comparing((Course course) -> favoriteCourseIds.contains(course.getId())).reversed()
                        .thenComparing(course -> {
                            WatchProgress progress = mostRecentPerCourse.get(course.getId());
                            return progress != null ? progress.getUpdatedAt() : null;
                        }, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(course -> {
                    WatchProgress latest = mostRecentPerCourse.get(course.getId());
                    Lecture lecture = findBestNextLecture(course, userId);
                    if (lecture == null) {
                        return null;
                    }
                    int progressSeconds = latest != null && latest.getLecture().getId().equals(lecture.getId())
                            ? latest.getLastPositionSeconds()
                            : 0;
                    return ContinueLearningItemDTO.builder()
                            .label("Best next lesson")
                            .courseId(course.getId())
                            .courseTitle(course.getTitle())
                            .lectureId(lecture.getId())
                            .lectureTitle(lecture.getTitle())
                            .progressSeconds(progressSeconds)
                            .progressPercentage(latest != null && latest.getLecture().getId().equals(lecture.getId())
                                    ? Math.round(calculateProgressPercent(latest) * 10.0) / 10.0
                                    : 0)
                            .completed(false)
                            .build();
                })
                .filter(Objects::nonNull)
                .limit(3)
                .toList();

        return ContinueLearningDTO.builder()
                .pickUpWhereYouLeftOff(pickup)
                .almostFinished(almostFinished)
                .bestNextLessons(bestNextLessons)
                .build();
    }

    private Lecture findBestNextLecture(Course course, String userId) {
        Map<UUID, WatchProgress> progressMap = watchProgressRepository.findByUserIdAndCourseId(userId, course.getId()).stream()
                .filter(p -> p.getLecture() != null && p.getLecture().getId() != null)
                .collect(Collectors.toMap(progress -> progress.getLecture().getId(), progress -> progress, (a, b) -> a));

        return course.getSections().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingInt(Section::getSortOrder))
                .flatMap(section -> section.getLectures().stream().filter(Objects::nonNull).sorted(Comparator.comparingInt(Lecture::getSortOrder)))
                .filter(lecture -> {
                    WatchProgress progress = progressMap.get(lecture.getId());
                    return progress == null || !progress.isCompleted();
                })
                .findFirst()
                .orElse(null);
    }

    private LessonSearchResultDTO mapSearchResult(Course course, Section section, Lecture lecture, WatchProgress progress, String query) {
        boolean matchedInTitle = lecture.getTitle().toLowerCase().contains(query);
        List<TranscriptCueDTO> transcriptMatches = s3Service.loadTranscriptCues(lecture.getS3Key()).stream()
                .filter(cue -> cue.getText().toLowerCase().contains(query))
                .limit(3)
                .toList();
        boolean matchedInTranscript = !transcriptMatches.isEmpty();

        if (!matchedInTitle && !matchedInTranscript) {
            return null;
        }

        return LessonSearchResultDTO.builder()
                .courseId(course.getId())
                .courseTitle(course.getTitle())
                .sectionId(section.getId())
                .sectionTitle(section.getTitle())
                .lectureId(lecture.getId())
                .lectureTitle(lecture.getTitle())
                .matchedInTitle(matchedInTitle)
                .matchedInTranscript(matchedInTranscript)
                .lastPositionSeconds(progress != null ? progress.getLastPositionSeconds() : 0)
                .completed(progress != null && progress.isCompleted())
                .transcriptMatches(transcriptMatches)
                .build();
    }

    private ContinueLearningItemDTO mapContinueLearningItem(String label, WatchProgress progress) {
        Lecture lecture = progress.getLecture();
        Course course = lecture.getSection().getCourse();
        return ContinueLearningItemDTO.builder()
                .label(label)
                .courseId(course.getId())
                .courseTitle(course.getTitle())
                .lectureId(lecture.getId())
                .lectureTitle(lecture.getTitle())
                .progressSeconds(progress.getLastPositionSeconds())
                .progressPercentage(Math.round(calculateProgressPercent(progress) * 10.0) / 10.0)
                .completed(progress.isCompleted())
                .build();
    }

    private double calculateProgressPercent(WatchProgress progress) {
        Integer duration = progress.getLecture().getDurationSeconds();
        if (duration == null || duration <= 0) {
            return 0;
        }
        return Math.min(100.0, progress.getLastPositionSeconds() * 100.0 / duration);
    }

    private LectureNoteDTO mapNote(@NonNull LectureNote note) {
        return LectureNoteDTO.builder()
                .id(note.getId())
                .timeSeconds(note.getTimeSeconds())
                .text(note.getText())
                .tags(parseTags(note.getTags()))
                .highlightColor(note.getHighlightColor())
                .createdAt(note.getCreatedAt())
                .build();
    }

    private LectureBookmarkDTO mapBookmark(@NonNull LectureBookmark bookmark) {
        return LectureBookmarkDTO.builder()
                .id(bookmark.getId())
                .timeSeconds(bookmark.getTimeSeconds())
                .label(bookmark.getLabel())
                .tags(parseTags(bookmark.getTags()))
                .highlightColor(bookmark.getHighlightColor())
                .createdAt(bookmark.getCreatedAt())
                .build();
    }

    private String serializeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }

        return tags.stream()
                .map(tag -> tag == null ? "" : tag.trim().toLowerCase())
                .filter(tag -> !tag.isBlank())
                .distinct()
                .limit(8)
                .collect(Collectors.joining(","));
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }

        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .toList();
    }

    private String normalizeColor(String color) {
        return color == null || color.isBlank() ? null : color.trim().toLowerCase();
    }
}
