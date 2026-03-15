package com.streamapp.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class StreamUrlDTO {
    private String url;
    private String subtitleUrl;
    private String subtitleFormat;
    private int expiresInMinutes;
}
