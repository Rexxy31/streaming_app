package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TranscriptCueDTO {
    private int startSeconds;
    private int endSeconds;
    private String text;
}
