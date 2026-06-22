resource "google_storage_bucket" "specs" {
  name                        = "spectrl-specs-prod"
  project                     = var.project_id
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "specs_public_read" {
  bucket = google_storage_bucket.specs.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket" "functions_source" {
  name                        = "spectrl-functions-source-prod"
  project                     = var.project_id
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true
}
