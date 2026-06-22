data "google_secret_manager_secret" "github_oauth_client_id" {
  secret_id = "github-oauth-client-id"
  project   = var.project_id
}

data "google_secret_manager_secret" "github_oauth_client_secret" {
  secret_id = "github-oauth-client-secret"
  project   = var.project_id
}
