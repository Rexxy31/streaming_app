package com.streamapp.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FavoriteCourseUpdateDTO {
    @NotNull
    private Boolean favorite;
}
