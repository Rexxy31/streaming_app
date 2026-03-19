package com.streamapp.service;

import com.streamapp.dto.ProgressUpdateDTO;
import com.streamapp.entity.Lecture;
import com.streamapp.entity.WatchProgress;
import com.streamapp.repository.LectureRepository;
import com.streamapp.repository.WatchProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProgressService {

    private final WatchProgressRepository watchProgressRepository;
    private final LectureRepository lectureRepository;

    @Transactional
    public WatchProgress updateProgress(String userId, @NonNull ProgressUpdateDTO dto) {
        UUID lectureId = Objects.requireNonNull(dto.getLectureId(), "Lecture ID must not be null");
        
        Lecture lecture = lectureRepository.findById(lectureId)
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + lectureId));

        WatchProgress progress = watchProgressRepository
                .findByUserIdAndLectureId(userId, lectureId)
                .orElseGet(() -> WatchProgress.builder()
                        .userId(userId)
                        .lecture(lecture)
                        .build());

        progress.setLastPositionSeconds(dto.getLastPositionSeconds());
        progress.setCompleted(dto.isCompleted());

        return watchProgressRepository.save(progress);
    }

    @Transactional(readOnly = true)
    public WatchProgress getProgress(String userId, @NonNull UUID lectureId) {
        return watchProgressRepository.findByUserIdAndLectureId(userId, lectureId)
                .orElse(WatchProgress.builder()
                        .userId(userId)
                        .lastPositionSeconds(0)
                        .completed(false)
                        .build());
    }
}
