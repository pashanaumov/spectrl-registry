variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "sa_key_path" {
  description = "Path to service account key JSON file"
  type        = string
  default     = "~/.gcp/spectrl-registry-sa.json"
}
