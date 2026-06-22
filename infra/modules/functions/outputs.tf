output "auth_device_init_url" {
  value = google_cloudfunctions2_function.functions["auth-device-init"].service_config[0].uri
}

output "auth_device_poll_url" {
  value = google_cloudfunctions2_function.functions["auth-device-poll"].service_config[0].uri
}

output "auth_exchange_url" {
  value = google_cloudfunctions2_function.functions["auth-exchange"].service_config[0].uri
}

output "get_spec_url" {
  value = google_cloudfunctions2_function.functions["get-spec"].service_config[0].uri
}

output "publish_spec_url" {
  value = google_cloudfunctions2_function.functions["publish-spec"].service_config[0].uri
}

output "search_specs_url" {
  value = google_cloudfunctions2_function.functions["search-specs"].service_config[0].uri
}

output "track_download_url" {
  value = google_cloudfunctions2_function.functions["track-download"].service_config[0].uri
}

output "unpublish_spec_url" {
  value = google_cloudfunctions2_function.functions["unpublish-spec"].service_config[0].uri
}
