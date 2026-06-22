terraform {
  backend "s3" {
    bucket         = "spectrl-terraform-state-prod"
    key            = "terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "spectrl-terraform-locks-prod"
    encrypt        = true
  }
}
