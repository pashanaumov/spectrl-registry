output "specs_bucket_name" {
  value = google_storage_bucket.specs.name
}

output "functions_source_bucket_name" {
  value = google_storage_bucket.functions_source.name
}
