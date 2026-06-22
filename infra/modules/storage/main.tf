resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket for storing spec files
resource "aws_s3_bucket" "registry" {
  bucket = "${var.project_name}-registry-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = {
    Name        = "Spectrl Registry"
    Environment = var.environment
    Purpose     = "Store spec files for public registry"
  }
}

# Enable versioning
resource "aws_s3_bucket_versioning" "registry" {
  bucket = aws_s3_bucket.registry.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "registry" {
  bucket = aws_s3_bucket.registry.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 60
    }

    filter {

    }
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

# Block public ACLs but we'll allow public read via bucket policy
resource "aws_s3_bucket_public_access_block" "registry" {
  bucket = aws_s3_bucket.registry.id

  block_public_acls       = true
  block_public_policy     = false # We need this false to allow our bucket policy
  ignore_public_acls      = true
  restrict_public_buckets = false # We need this false to allow public read
}

# Bucket policy for CloudFront OAC and public read on /specs/* path
resource "aws_s3_bucket_policy" "registry" {
  bucket = aws_s3_bucket.registry.id

  # Ensure public access block is configured first
  depends_on = [aws_s3_bucket_public_access_block.registry]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.registry.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.registry.arn
          }
        }
      },
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.registry.arn}/specs/*"
      }
    ]
  })
}

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

#### CloudFront configs

# CloudFront Origin Access Control for S3

resource "aws_cloudfront_origin_access_control" "registry" {
  name                              = "${var.project_name}-registry-${var.environment}-oac"
  description                       = "OAC for Spectrl Registry S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution for global CDN
resource "aws_cloudfront_distribution" "registry" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Spectrl Registry CDN"
  default_root_object = ""
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.registry.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.registry.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.registry.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.registry.id}"

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS Managed-CachingOptimized

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 24 hours
    max_ttl                = 31536000 # 1 year
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "Spectrl Registry CDN"
    Environment = var.environment
  }
}
