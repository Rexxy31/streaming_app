package com.streamapp.service;

import com.streamapp.dto.ProgressUpdateDTO;
import com.streamapp.entity.Lecture;
import com.streamapp.entity.WatchProgress;
import com.streamapp.repository.LectureRepository;
import com.streamapp.repository.WatchProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProgressService {

    private final WatchProgressRepository watchProgressRepository;
    private final LectureRepository lectureRepository;

    @Transactional
    public WatchProgress updateProgress(String userId, ProgressUpdateDTO dto) {
        Lecture lecture = lectureRepository.findById(dto.getLectureId())
                .orElseThrow(() -> new NoSuchElementException("Lecture not found: " + dto.getLectureId()));

        WatchProgress progress = watchProgressRepository
                .findByUserIdAndLectureId(userId, dto.getLectureId())
                .orElseGet(() -> WatchProgress.builder()
                        .userId(userId)
                        .lecture(lecture)
                        .build());

        progress.setLastPositionSeconds(dto.getLastPositionSeconds());
        progress.setCompleted(dto.isCompleted());

        return watchProgressRepository.save(progress);
    }

    @Transactional(readOnly = true)
    public WatchProgress getProgress(String userId, UUID lectureId) {
        return watchProgressRepository.findByUserIdAndLectureId(userId, lectureId)
                .orElse(WatchProgress.builder()
                        .userId(userId)
                        .lastPositionSeconds(0)
                        .completed(false)
                        .build());
    }
}
