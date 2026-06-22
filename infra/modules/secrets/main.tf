# AWS Secrets Manager secret for GitHub OAuth credentials
resource "aws_secretsmanager_secret" "github_oauth" {
  name        = "${var.project_name}/github-oauth-${var.environment}"
  description = "GitHub OAuth credentials for Spectrl ${var.environment} environment"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Store placeholder OAuth credentials
resource "aws_secretsmanager_secret_version" "github_oauth_value" {
  secret_id = aws_secretsmanager_secret.github_oauth.id
  secret_string = jsonencode({
    clientId     = "placeholder"
    clientSecret = "placeholder"
  })

  # Ignore changes to secret_string after initial creation
  # This allows manual updates without Terraform overwriting them
  lifecycle {
    ignore_changes = [secret_string]
  }
}


