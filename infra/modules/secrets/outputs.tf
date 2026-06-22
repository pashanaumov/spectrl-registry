output "github_oauth_client_id_secret_name" {
  value = data.google_secret_manager_secret.github_oauth_client_id.secret_id
}

output "github_oauth_client_secret_secret_name" {
  value = data.google_secret_manager_secret.github_oauth_client_secret.secret_id
}
