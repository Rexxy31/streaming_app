package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LessonSearchResultDTO {
    private UUID courseId;
    private String courseTitle;
    private UUID sectionId;
    private String sectionTitle;
    private UUID lectureId;
    private String lectureTitle;
    private boolean matchedInTitle;
    private boolean matchedInTranscript;
    private int lastPositionSeconds;
    private boolean completed;
    private List<TranscriptCueDTO> transcriptMatches;
}
