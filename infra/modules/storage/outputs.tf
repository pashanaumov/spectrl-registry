output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.registry.id
}

output "cloudfront_url" {
  description = "Full HTTPS URL of the CloudFront distribution"
  value       = "https://${aws_cloudfront_distribution.registry.domain_name}"
}
