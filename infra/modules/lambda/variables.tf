variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-north-1"
}

variable "bucket_name" {
  description = "S3 bucket name for spec storage"
  type        = string
}

variable "specs_table_name" {
  description = "DynamoDB specs table name"
  type        = string
}

variable "specs_table_arn" {
  description = "DynamoDB specs table ARN"
  type        = string
}

variable "users_table_name" {
  description = "DynamoDB users table name"
  type        = string
}

variable "users_table_arn" {
  description = "DynamoDB users table ARN"
  type        = string
}

variable "github_oauth_secret_arn" {
  description = "ARN of GitHub OAuth secret"
  type        = string
}

variable "lambda_source_dir" {
  description = "Path to Lambda source code directory"
  type        = string
}
