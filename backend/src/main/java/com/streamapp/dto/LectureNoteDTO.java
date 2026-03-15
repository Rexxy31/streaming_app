package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LectureNoteDTO {
    private UUID id;
    private int timeSeconds;
    private String text;
    private List<String> tags;
    private String highlightColor;
    private LocalDateTime createdAt;
}
