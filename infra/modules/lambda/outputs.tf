output "auth_device_init_function_name" {
  description = "Name of the auth-device-init Lambda function"
  value       = aws_lambda_function.auth_device_init.function_name
}

output "auth_device_init_function_arn" {
  description = "ARN of the auth-device-init Lambda function"
  value       = aws_lambda_function.auth_device_init.arn
}

output "auth_device_init_invoke_arn" {
  description = "Invoke ARN of the auth-device-init Lambda function"
  value       = aws_lambda_function.auth_device_init.invoke_arn
}

output "auth_device_poll_function_name" {
  description = "Name of the auth-device-poll Lambda function"
  value       = aws_lambda_function.auth_device_poll.function_name
}

output "auth_device_poll_function_arn" {
  description = "ARN of the auth-device-poll Lambda function"
  value       = aws_lambda_function.auth_device_poll.arn
}

output "auth_device_poll_invoke_arn" {
  description = "Invoke ARN of the auth-device-poll Lambda function"
  value       = aws_lambda_function.auth_device_poll.invoke_arn
}

output "auth_exchange_function_name" {
  description = "Name of the auth-exchange Lambda function"
  value       = aws_lambda_function.auth_exchange.function_name
}

output "auth_exchange_function_arn" {
  description = "ARN of the auth-exchange Lambda function"
  value       = aws_lambda_function.auth_exchange.arn
}

output "auth_exchange_invoke_arn" {
  description = "Invoke ARN of the auth-exchange Lambda function"
  value       = aws_lambda_function.auth_exchange.invoke_arn
}

output "publish_spec_function_name" {
  description = "Name of the publish-spec Lambda function"
  value       = aws_lambda_function.publish_spec.function_name
}

output "publish_spec_function_arn" {
  description = "ARN of the publish-spec Lambda function"
  value       = aws_lambda_function.publish_spec.arn
}

output "publish_spec_invoke_arn" {
  description = "Invoke ARN of the publish-spec Lambda function"
  value       = aws_lambda_function.publish_spec.invoke_arn
}

output "search_specs_function_name" {
  description = "Name of the search-specs Lambda function"
  value       = aws_lambda_function.search_specs.function_name
}

output "search_specs_function_arn" {
  description = "ARN of the search-specs Lambda function"
  value       = aws_lambda_function.search_specs.arn
}

output "search_specs_invoke_arn" {
  description = "Invoke ARN of the search-specs Lambda function"
  value       = aws_lambda_function.search_specs.invoke_arn
}

output "get_spec_function_name" {
  description = "Name of the get-spec Lambda function"
  value       = aws_lambda_function.get_spec.function_name
}

output "get_spec_function_arn" {
  description = "ARN of the get-spec Lambda function"
  value       = aws_lambda_function.get_spec.arn
}

output "get_spec_invoke_arn" {
  description = "Invoke ARN of the get-spec Lambda function"
  value       = aws_lambda_function.get_spec.invoke_arn
}

output "unpublish_spec_function_name" {
  description = "Name of the unpublish-spec Lambda function"
  value       = aws_lambda_function.unpublish_spec.function_name
}

output "unpublish_spec_function_arn" {
  description = "ARN of the unpublish-spec Lambda function"
  value       = aws_lambda_function.unpublish_spec.arn
}

output "unpublish_spec_invoke_arn" {
  description = "Invoke ARN of the unpublish-spec Lambda function"
  value       = aws_lambda_function.unpublish_spec.invoke_arn
}

output "track_download_function_name" {
  description = "Name of the track-download Lambda function"
  value       = aws_lambda_function.track_download.function_name
}

output "track_download_function_arn" {
  description = "ARN of the track-download Lambda function"
  value       = aws_lambda_function.track_download.arn
}

output "track_download_invoke_arn" {
  description = "Invoke ARN of the track-download Lambda function"
  value       = aws_lambda_function.track_download.invoke_arn
}
