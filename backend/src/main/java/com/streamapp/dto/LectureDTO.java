package com.streamapp.dto;

import lombok.*;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class LectureDTO {
    private UUID id;
    private String title;
    private int sortOrder;
    private Integer durationSeconds;
    private String subtitleStatus;
    private boolean hasSubtitle;
    private boolean completed;
    private int lastPositionSeconds;
}
