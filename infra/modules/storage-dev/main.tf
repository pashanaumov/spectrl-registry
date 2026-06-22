# Simplified storage module for LocalStack (no CloudFront)

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket for storing spec files
resource "aws_s3_bucket" "registry" {
  bucket = "${var.project_name}-registry-${var.environment}-${random_id.bucket_suffix.hex}"

  # Tags removed for LocalStack compatibility
}

# Enable versioning
resource "aws_s3_bucket_versioning" "registry" {
  bucket = aws_s3_bucket.registry.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption (AES-256)
resource "aws_s3_bucket_server_side_encryption_configuration" "registry" {
  bucket = aws_s3_bucket.registry.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Allow public access for dev (simpler than CloudFront)
resource "aws_s3_bucket_public_access_block" "registry" {
  bucket = aws_s3_bucket.registry.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Bucket policy for public read access
resource "aws_s3_bucket_policy" "registry" {
  bucket = aws_s3_bucket.registry.id

  depends_on = [aws_s3_bucket_public_access_block.registry]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.registry.arn}/*"
      }
    ]
  })
}

# CORS configuration for browser access
resource "aws_s3_bucket_cors_configuration" "registry" {
  bucket = aws_s3_bucket.registry.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}
