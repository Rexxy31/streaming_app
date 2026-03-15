package com.streamapp.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "lectures", indexes = @Index(columnList = "s3_key"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Lecture {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(name = "s3_key", nullable = false)
    private String s3Key;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "sort_order")
    private int sortOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id", nullable = false)
    @JsonIgnore
    private Section section;
}
