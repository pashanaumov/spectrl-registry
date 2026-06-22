# Storage outputs

output "storage_bucket_name" {
  description = "Name of the S3 bucket for spec storage"
  value       = module.storage.bucket_name
}

output "storage_bucket_endpoint" {
  description = "S3 bucket endpoint for direct access (LocalStack)"
  value       = module.storage.bucket_endpoint
}

# DynamoDB tables
output "specs_table_name" {
  value       = module.database.specs_table_name
  description = "Spectrl DynamoDB specs table name"
}

output "users_table_name" {
  value       = module.database.users_table_name
  description = "Spectrl DynamoDB users table name"
}

output "specs_table_arn" {
  value       = module.database.specs_table_arn
  description = "Spectrl DynamoDB specs table ARN"
}
output "users_table_arn" {
  value       = module.database.users_table_arn
  description = "Spectrl DynamoDB users table ARN"
}

# Secrets outputs
output "github_oauth_secret_arn" {
  value       = module.secrets.github_oauth_secret_arn
  description = "ARN of the GitHub OAuth secret"
}

output "github_oauth_secret_name" {
  value       = module.secrets.github_oauth_secret_name
  description = "Name of the GitHub OAuth secret"
}

# Lambda outputs
output "auth_exchange_function_name" {
  value       = module.lambda.auth_exchange_function_name
  description = "Name of the auth-exchange Lambda function"
}

output "auth_exchange_function_arn" {
  value       = module.lambda.auth_exchange_function_arn
  description = "ARN of the auth-exchange Lambda function"
}

output "publish_spec_function_name" {
  value       = module.lambda.publish_spec_function_name
  description = "Name of the publish-spec Lambda function"
}

output "publish_spec_function_arn" {
  value       = module.lambda.publish_spec_function_arn
  description = "ARN of the publish-spec Lambda function"
}

# API Gateway outputs
output "api_endpoint" {
  value       = module.api_gateway.api_endpoint
  description = "Base URL of the API Gateway (use this to make requests)"
}

output "api_id" {
  value       = module.api_gateway.api_id
  description = "ID of the API Gateway REST API"
}
