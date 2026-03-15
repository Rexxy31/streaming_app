package com.streamapp.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.util.UUID;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ProgressUpdateDTO {

    @NotNull
    private UUID lectureId;

    @Min(0)
    private int lastPositionSeconds;

    private boolean completed;
}
