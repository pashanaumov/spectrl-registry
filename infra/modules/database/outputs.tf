output "specs_table_name" {
  value       = aws_dynamodb_table.specs.name
  description = "Spectrl DynamoDB specs table name"
}

output "specs_table_arn" {
  value       = aws_dynamodb_table.specs.arn
  description = "Spectrl DynamoDB specs table ARN"
}

output "users_table_name" {
  value       = aws_dynamodb_table.users.name
  description = "Spectrl DynamoDB users table name"
}

output "users_table_arn" {
  value       = aws_dynamodb_table.users.arn
  description = "Spectrl DynamoDB users table ARN"
}
