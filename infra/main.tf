terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.2"

  backend "gcs" {
    bucket = "spectrl-registry-tf-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project     = var.project_id
  region      = var.region
  credentials = file(var.sa_key_path)
}

module "storage" {
  source     = "./modules/storage"
  project_id = var.project_id
  region     = var.region
}

module "database" {
  source     = "./modules/database"
  project_id = var.project_id
  region     = var.region
}

module "secrets" {
  source     = "./modules/secrets"
  project_id = var.project_id
}

module "functions" {
  source                            = "./modules/functions"
  project_id                        = var.project_id
  region                            = var.region
  bucket_name                       = module.storage.specs_bucket_name
  github_oauth_client_id_secret     = module.secrets.github_oauth_client_id_secret_name
  github_oauth_client_secret_secret = module.secrets.github_oauth_client_secret_secret_name
}
