variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
}

# Lambda function names
variable "auth_device_init_function_name" {
  description = "Name of the auth-device-init Lambda function"
  type        = string
}

variable "auth_device_poll_function_name" {
  description = "Name of the auth-device-poll Lambda function"
  type        = string
}

variable "auth_exchange_function_name" {
  description = "Name of the auth-exchange Lambda function"
  type        = string
}

variable "publish_spec_function_name" {
  description = "Name of the publish-spec Lambda function"
  type        = string
}

variable "search_specs_function_name" {
  description = "Name of the search-specs Lambda function"
  type        = string
}

variable "get_spec_function_name" {
  description = "Name of the get-spec Lambda function"
  type        = string
}

variable "unpublish_spec_function_name" {
  description = "Name of the unpublish-spec Lambda function"
  type        = string
}

variable "track_download_function_name" {
  description = "Name of the track-download Lambda function"
  type        = string
}

# Lambda invoke ARNs
variable "auth_device_init_invoke_arn" {
  description = "Invoke ARN of the auth-device-init Lambda function"
  type        = string
}

variable "auth_device_poll_invoke_arn" {
  description = "Invoke ARN of the auth-device-poll Lambda function"
  type        = string
}

variable "auth_exchange_invoke_arn" {
  description = "Invoke ARN of the auth-exchange Lambda function"
  type        = string
}

variable "publish_spec_invoke_arn" {
  description = "Invoke ARN of the publish-spec Lambda function"
  type        = string
}

variable "search_specs_invoke_arn" {
  description = "Invoke ARN of the search-specs Lambda function"
  type        = string
}

variable "get_spec_invoke_arn" {
  description = "Invoke ARN of the get-spec Lambda function"
  type        = string
}

variable "unpublish_spec_invoke_arn" {
  description = "Invoke ARN of the unpublish-spec Lambda function"
  type        = string
}

variable "track_download_invoke_arn" {
  description = "Invoke ARN of the track-download Lambda function"
  type        = string
}
