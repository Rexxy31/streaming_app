package com.streamapp.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SectionDTO {
    private UUID id;
    private String title;
    private int sortOrder;
    private List<LectureDTO> lectures;
}
