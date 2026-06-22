terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }
  }

  required_version = ">= 1.2"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Import shared modules
module "storage" {
  source = "../../modules/storage"

  project_name = var.project_name
  environment  = var.environment
}

module "database" {
  source = "../../modules/database"

  project_name = var.project_name
  environment  = var.environment
}

module "secrets" {
  source = "../../modules/secrets"

  project_name = var.project_name
  environment  = var.environment
}

module "lambda" {
  source = "../../modules/lambda"

  project_name            = var.project_name
  environment             = var.environment
  aws_region              = var.aws_region
  bucket_name             = module.storage.bucket_name
  specs_table_name        = module.database.specs_table_name
  specs_table_arn         = module.database.specs_table_arn
  users_table_name        = module.database.users_table_name
  users_table_arn         = module.database.users_table_arn
  github_oauth_secret_arn = module.secrets.github_oauth_secret_arn
  lambda_source_dir       = abspath("${path.root}/../../../api/dist")
}

module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name = var.project_name
  environment  = var.environment

  # Lambda function names
  auth_device_init_function_name = module.lambda.auth_device_init_function_name
  auth_device_poll_function_name = module.lambda.auth_device_poll_function_name
  auth_exchange_function_name    = module.lambda.auth_exchange_function_name
  publish_spec_function_name     = module.lambda.publish_spec_function_name
  search_specs_function_name     = module.lambda.search_specs_function_name
  get_spec_function_name         = module.lambda.get_spec_function_name
  unpublish_spec_function_name   = module.lambda.unpublish_spec_function_name
  track_download_function_name   = module.lambda.track_download_function_name

  # Lambda invoke ARNs
  auth_device_init_invoke_arn = module.lambda.auth_device_init_invoke_arn
  auth_device_poll_invoke_arn = module.lambda.auth_device_poll_invoke_arn
  auth_exchange_invoke_arn    = module.lambda.auth_exchange_invoke_arn
  publish_spec_invoke_arn     = module.lambda.publish_spec_invoke_arn
  search_specs_invoke_arn     = module.lambda.search_specs_invoke_arn
  get_spec_invoke_arn         = module.lambda.get_spec_invoke_arn
  unpublish_spec_invoke_arn   = module.lambda.unpublish_spec_invoke_arn
  track_download_invoke_arn   = module.lambda.track_download_invoke_arn
}
