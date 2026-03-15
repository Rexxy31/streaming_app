package com.streamapp.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ContinueLearningDTO {
    private ContinueLearningItemDTO pickUpWhereYouLeftOff;
    private ContinueLearningItemDTO almostFinished;
    private List<ContinueLearningItemDTO> bestNextLessons;
}
