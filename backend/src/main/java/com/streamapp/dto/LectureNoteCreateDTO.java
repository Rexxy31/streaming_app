package com.streamapp.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class LectureNoteCreateDTO {
    @Min(0)
    private int timeSeconds;

    @NotBlank
    @Size(max = 4000)
    private String text;

    @Size(max = 8)
    private List<@Size(max = 32) String> tags;

    @Size(max = 32)
    private String highlightColor;
}
