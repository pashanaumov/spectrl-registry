output "specs_bucket_name" {
  value = module.storage.specs_bucket_name
}

output "auth_device_init_url" {
  value = module.functions.auth_device_init_url
}

output "auth_device_poll_url" {
  value = module.functions.auth_device_poll_url
}

output "auth_exchange_url" {
  value = module.functions.auth_exchange_url
}

output "get_spec_url" {
  value = module.functions.get_spec_url
}

output "publish_spec_url" {
  value = module.functions.publish_spec_url
}

output "search_specs_url" {
  value = module.functions.search_specs_url
}

output "track_download_url" {
  value = module.functions.track_download_url
}

output "unpublish_spec_url" {
  value = module.functions.unpublish_spec_url
}
