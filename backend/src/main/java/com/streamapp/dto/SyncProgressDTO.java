package com.streamapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncProgressDTO {
    private boolean active;
    private String status;
    private int current;
    private int total;
    private int successCount;
    private int failureCount;

    public int getPercentage() {
        if (total <= 0) return 0;
        return (int) Math.round((double) current / total * 100);
    }
}
