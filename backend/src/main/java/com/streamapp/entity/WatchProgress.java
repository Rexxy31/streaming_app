package com.streamapp.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "watch_progress", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "lecture_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WatchProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecture_id", nullable = false)
    private Lecture lecture;

    @Column(name = "last_position_seconds")
    private int lastPositionSeconds;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
