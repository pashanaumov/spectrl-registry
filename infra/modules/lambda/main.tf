# IAM role for auth-device-init Lambda
resource "aws_iam_role" "auth_device_init" {
  name = "${var.project_name}-auth-device-init-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for auth-device-init Lambda
resource "aws_iam_role_policy" "auth_device_init" {
  name = "${var.project_name}-auth-device-init-policy-${var.environment}"
  role = aws_iam_role.auth_device_init.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.github_oauth_secret_arn
      }
    ]
  })
}

# Package auth-device-init Lambda
data "archive_file" "auth_device_init" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/auth-device-init"
  output_path = "${path.module}/builds/auth-device-init.zip"
  excludes    = ["*.map", "*.d.ts"]
  
  depends_on = [var.lambda_source_dir]
}

# auth-device-init Lambda function
resource "aws_lambda_function" "auth_device_init" {
  filename         = data.archive_file.auth_device_init.output_path
  function_name    = "${var.project_name}-auth-device-init-${var.environment}"
  role            = aws_iam_role.auth_device_init.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.auth_device_init.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      SECRETS_ARN = var.github_oauth_secret_arn
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for auth-device-init
resource "aws_cloudwatch_log_group" "auth_device_init" {
  name              = "/aws/lambda/${aws_lambda_function.auth_device_init.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for auth-device-poll Lambda
resource "aws_iam_role" "auth_device_poll" {
  name = "${var.project_name}-auth-device-poll-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for auth-device-poll Lambda
resource "aws_iam_role_policy" "auth_device_poll" {
  name = "${var.project_name}-auth-device-poll-policy-${var.environment}"
  role = aws_iam_role.auth_device_poll.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.github_oauth_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = var.users_table_arn
      }
    ]
  })
}

# Package auth-device-poll Lambda
data "archive_file" "auth_device_poll" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/auth-device-poll"
  output_path = "${path.module}/builds/auth-device-poll.zip"
  excludes    = ["*.map", "*.d.ts"]
  
  depends_on = [var.lambda_source_dir]
}

# auth-device-poll Lambda function
resource "aws_lambda_function" "auth_device_poll" {
  filename         = data.archive_file.auth_device_poll.output_path
  function_name    = "${var.project_name}-auth-device-poll-${var.environment}"
  role            = aws_iam_role.auth_device_poll.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.auth_device_poll.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      SECRETS_ARN = var.github_oauth_secret_arn
      USERS_TABLE = var.users_table_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for auth-device-poll
resource "aws_cloudwatch_log_group" "auth_device_poll" {
  name              = "/aws/lambda/${aws_lambda_function.auth_device_poll.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for auth-exchange Lambda
resource "aws_iam_role" "auth_exchange" {
  name = "${var.project_name}-auth-exchange-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for auth-exchange Lambda
resource "aws_iam_role_policy" "auth_exchange" {
  name = "${var.project_name}-auth-exchange-policy-${var.environment}"
  role = aws_iam_role.auth_exchange.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.github_oauth_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = var.users_table_arn
      }
    ]
  })
}

# Package auth-exchange Lambda
data "archive_file" "auth_exchange" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/auth-exchange"
  output_path = "${path.module}/builds/auth-exchange.zip"
  excludes    = ["*.map", "*.d.ts"]
  
  depends_on = [var.lambda_source_dir]
}

# auth-exchange Lambda function
resource "aws_lambda_function" "auth_exchange" {
  filename         = data.archive_file.auth_exchange.output_path
  function_name    = "${var.project_name}-auth-exchange-${var.environment}"
  role            = aws_iam_role.auth_exchange.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.auth_exchange.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      SECRETS_ARN = var.github_oauth_secret_arn
      USERS_TABLE = var.users_table_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for auth-exchange
resource "aws_cloudwatch_log_group" "auth_exchange" {
  name              = "/aws/lambda/${aws_lambda_function.auth_exchange.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for publish-spec Lambda
resource "aws_iam_role" "publish_spec" {
  name = "${var.project_name}-publish-spec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for publish-spec Lambda
resource "aws_iam_role_policy" "publish_spec" {
  name = "${var.project_name}-publish-spec-policy-${var.environment}"
  role = aws_iam_role.publish_spec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = var.specs_table_arn
      }
    ]
  })
}

# Package publish-spec Lambda
data "archive_file" "publish_spec" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/publish-spec"
  output_path = "${path.module}/builds/publish-spec.zip"
  excludes    = ["*.map", "*.d.ts"]
}

# publish-spec Lambda function
resource "aws_lambda_function" "publish_spec" {
  filename         = data.archive_file.publish_spec.output_path
  function_name    = "${var.project_name}-publish-spec-${var.environment}"
  role            = aws_iam_role.publish_spec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.publish_spec.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 60
  memory_size     = 512

  environment {
    variables = {
      BUCKET_NAME  = var.bucket_name
      SPECS_TABLE  = var.specs_table_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for publish-spec
resource "aws_cloudwatch_log_group" "publish_spec" {
  name              = "/aws/lambda/${aws_lambda_function.publish_spec.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for search-specs Lambda
resource "aws_iam_role" "search_specs" {
  name = "${var.project_name}-search-specs-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for search-specs Lambda
resource "aws_iam_role_policy" "search_specs" {
  name = "${var.project_name}-search-specs-policy-${var.environment}"
  role = aws_iam_role.search_specs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan"
        ]
        Resource = var.specs_table_arn
      }
    ]
  })
}

# Package search-specs Lambda
data "archive_file" "search_specs" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/search-specs"
  output_path = "${path.module}/builds/search-specs.zip"
  excludes    = ["*.map", "*.d.ts"]
}

# search-specs Lambda function
resource "aws_lambda_function" "search_specs" {
  filename         = data.archive_file.search_specs.output_path
  function_name    = "${var.project_name}-search-specs-${var.environment}"
  role            = aws_iam_role.search_specs.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.search_specs.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      SPECS_TABLE = var.specs_table_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for search-specs
resource "aws_cloudwatch_log_group" "search_specs" {
  name              = "/aws/lambda/${aws_lambda_function.search_specs.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for get-spec Lambda
resource "aws_iam_role" "get_spec" {
  name = "${var.project_name}-get-spec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for get-spec Lambda
resource "aws_iam_role_policy" "get_spec" {
  name = "${var.project_name}-get-spec-policy-${var.environment}"
  role = aws_iam_role.get_spec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query"
        ]
        Resource = var.specs_table_arn
      }
    ]
  })
}

# Package get-spec Lambda
data "archive_file" "get_spec" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/get-spec"
  output_path = "${path.module}/builds/get-spec.zip"
  excludes    = ["*.map", "*.d.ts"]
}

# get-spec Lambda function
resource "aws_lambda_function" "get_spec" {
  filename         = data.archive_file.get_spec.output_path
  function_name    = "${var.project_name}-get-spec-${var.environment}"
  role            = aws_iam_role.get_spec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.get_spec.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      SPECS_TABLE = var.specs_table_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for get-spec
resource "aws_cloudwatch_log_group" "get_spec" {
  name              = "/aws/lambda/${aws_lambda_function.get_spec.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for unpublish-spec Lambda
resource "aws_iam_role" "unpublish_spec" {
  name = "${var.project_name}-unpublish-spec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for unpublish-spec Lambda
resource "aws_iam_role_policy" "unpublish_spec" {
  name = "${var.project_name}-unpublish-spec-policy-${var.environment}"
  role = aws_iam_role.unpublish_spec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem"
        ]
        Resource = var.specs_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.bucket_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      }
    ]
  })
}

# Package unpublish-spec Lambda
data "archive_file" "unpublish_spec" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/unpublish-spec"
  output_path = "${path.module}/builds/unpublish-spec.zip"
  excludes    = ["*.map", "*.d.ts"]
}

# unpublish-spec Lambda function
resource "aws_lambda_function" "unpublish_spec" {
  filename         = data.archive_file.unpublish_spec.output_path
  function_name    = "${var.project_name}-unpublish-spec-${var.environment}"
  role            = aws_iam_role.unpublish_spec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.unpublish_spec.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 60
  memory_size     = 512

  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
      SPECS_TABLE = var.specs_table_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for unpublish-spec
resource "aws_cloudwatch_log_group" "unpublish_spec" {
  name              = "/aws/lambda/${aws_lambda_function.unpublish_spec.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for track-download Lambda
resource "aws_iam_role" "track_download" {
  name = "${var.project_name}-track-download-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM policy for track-download Lambda
resource "aws_iam_role_policy" "track_download" {
  name = "${var.project_name}-track-download-policy-${var.environment}"
  role = aws_iam_role.track_download.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem"
        ]
        Resource = var.specs_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.github_oauth_secret_arn
      }
    ]
  })
}

# Package track-download Lambda
data "archive_file" "track_download" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/track-download"
  output_path = "${path.module}/builds/track-download.zip"
  excludes    = ["*.map", "*.d.ts"]
}

# track-download Lambda function
resource "aws_lambda_function" "track_download" {
  filename         = data.archive_file.track_download.output_path
  function_name    = "${var.project_name}-track-download-${var.environment}"
  role            = aws_iam_role.track_download.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.track_download.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      SPECS_TABLE = var.specs_table_name
      SECRETS_ARN = var.github_oauth_secret_arn
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for track-download
resource "aws_cloudwatch_log_group" "track_download" {
  name              = "/aws/lambda/${aws_lambda_function.track_download.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
