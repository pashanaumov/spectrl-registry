output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.registry.id
}

output "bucket_endpoint" {
  description = "S3 bucket endpoint URL for direct access"
  value       = "http://${aws_s3_bucket.registry.bucket}.s3.localhost.localstack.cloud:4566"
}
