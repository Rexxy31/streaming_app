package com.streamapp;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

public class S3ListObjects {

    @Test
    public void listAllObjects() {
        String accessKey = System.getenv("AWS_ACCESS_KEY");
        String secretKey = System.getenv("AWS_SECRET_KEY");
        String region = System.getenv().getOrDefault("AWS_REGION", "ap-south-1");
        String bucketName = System.getenv("AWS_S3_BUCKET");

        S3Client s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();

        ListObjectsV2Request request = ListObjectsV2Request.builder()
                .bucket(bucketName)
                .prefix("Spring_Boot_RESTful_API/")
                .build();

        ListObjectsV2Response response;
        System.out.println("Listing objects in bucket: " + bucketName);
        do {
            response = s3Client.listObjectsV2(request);
            for (S3Object s3Object : response.contents()) {
                System.out.println(s3Object.key());
            }
            request = request.toBuilder()
                    .continuationToken(response.nextContinuationToken())
                    .build();
        } while (response.isTruncated());
    }
}
