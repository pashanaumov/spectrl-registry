resource "google_service_account" "api_sa" {
  project      = var.project_id
  account_id   = "spectrl-api-sa"
  display_name = "Spectrl API Service Account"
}

resource "google_project_iam_member" "api_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_project_iam_member" "api_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_project_iam_member" "api_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  location = var.region
  name     = "spectrl-api"

  template {
    service_account = google_service_account.api_sa.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"  # placeholder, replaced by source deploy

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "BUCKET_NAME"
        value = var.bucket_name
      }
      env {
        name  = "GITHUB_CLIENT_ID_SECRET"
        value = var.github_oauth_client_id_secret
      }
      env {
        name  = "GITHUB_CLIENT_SECRET_SECRET"
        value = var.github_oauth_client_secret_secret
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
