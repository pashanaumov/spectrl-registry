output "state_bucket_name" {
  value       = module.terraform_state.state_bucket_name
  description = "Name of the S3 bucket for Terraform state"
}

output "locks_table_name" {
  value       = module.terraform_state.locks_table_name
  description = "Name of the DynamoDB table for state locking"
}

output "backend_config" {
  value = <<-EOT
    
    Update your backend.tf with:
    
    terraform {
      backend "s3" {
        bucket         = "${module.terraform_state.state_bucket_name}"
        key            = "terraform.tfstate"
        region         = "${var.aws_region}"
        dynamodb_table = "${module.terraform_state.locks_table_name}"
        encrypt        = true
      }
    }
  EOT
  description = "Backend configuration to use"
}
