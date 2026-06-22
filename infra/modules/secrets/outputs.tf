output "github_oauth_secret_arn" {
  value       = aws_secretsmanager_secret.github_oauth.arn
  description = "ARN of the GitHub OAuth secret"
}

output "github_oauth_secret_name" {
  value       = aws_secretsmanager_secret.github_oauth.name
  description = "Name of the GitHub OAuth secret"
}
