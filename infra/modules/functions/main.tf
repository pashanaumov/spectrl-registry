locals {
  function_names = [
    "auth-device-init",
    "auth-device-poll",
    "auth-exchange",
    "get-spec",
    "publish-spec",
    "search-specs",
    "track-download",
    "unpublish-spec",
  ]

  env_vars = {
    GCP_PROJECT_ID           = var.project_id
    BUCKET_NAME              = var.bucket_name
    GITHUB_CLIENT_ID_SECRET  = var.github_oauth_client_id_secret
    GITHUB_CLIENT_SECRET_SECRET = var.github_oauth_client_secret_secret
  }
}

resource "google_service_account" "functions_sa" {
  project      = var.project_id
  account_id   = "spectrl-functions-sa"
  display_name = "Spectrl Functions Service Account"
}

resource "google_project_iam_member" "functions_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

resource "google_project_iam_member" "functions_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

resource "google_project_iam_member" "functions_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

resource "google_cloudfunctions2_function" "functions" {
  for_each = toset(local.function_names)

  project  = var.project_id
  location = var.region
  name     = each.key

  build_config {
    runtime     = "nodejs20"
    entry_point = "handler"

    source {
      storage_source {
        bucket = var.source_bucket_name
        object = "${each.key}.zip"
      }
    }
  }

  service_config {
    min_instance_count    = 0
    max_instance_count    = 10
    service_account_email = google_service_account.functions_sa.email

    environment_variables = local.env_vars
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  for_each = toset(local.function_names)

  project  = var.project_id
  location = var.region
  name     = google_cloudfunctions2_function.functions[each.key].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
