terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }
  }

  required_version = ">= 1.2"

  # Use local backend for bootstrapping the state backend itself
  backend "local" {
    path = "terraform.tfstate"
  }
}

# When using tflocal, it automatically configures endpoints
provider "aws" {
  region = var.aws_region
}

# Create the state backend infrastructure
module "terraform_state" {
  source = "../../../modules/terraform-state"

  project_name = var.project_name
  environment  = var.environment
}
