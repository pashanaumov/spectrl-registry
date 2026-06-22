# DynamoDB table for spec metadata
# Stores information about published specs including versions, authors, and download counts
resource "aws_dynamodb_table" "specs" {
  name         = "${var.project_name}-specs-${var.environment}"
  billing_mode = "PAY_PER_REQUEST" # On-demand billing - pay only for what you use
  hash_key     = "specId"          # Format: "username/spec-name"
  range_key    = "version"         # Format: "1.0.0"

  attribute {
    name = "specId"
    type = "S"
  }

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "allSpecs"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  # GSI for querying all specs by a specific user, sorted by creation date
  global_secondary_index {
    name            = "username-createdAt-index"
    hash_key        = "username"
    range_key       = "createdAt"
    projection_type = "ALL" # Include all attributes in the index
  }

  # GSI for querying recently published specs across all users
  # All items have allSpecs="ALL" to group them together
  global_secondary_index {
    name            = "all-createdAt-index"
    hash_key        = "allSpecs"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# DynamoDB table for user data from GitHub OAuth
# Stores GitHub user information for authentication and namespace validation
resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "githubId" # GitHub user ID (stable, doesn't change)

  attribute {
    name = "githubId"
    type = "N"
  }

  attribute {
    name = "username"
    type = "S"
  }

  # GSI for looking up users by username (for namespace validation)
  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
