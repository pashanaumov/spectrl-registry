# API Gateway REST API
resource "aws_api_gateway_rest_api" "spectrl" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "Spectrl public registry API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================================================
# /auth/exchange - POST
# ============================================================================

resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_rest_api.spectrl.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_resource" "auth_exchange" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "exchange"
}

resource "aws_api_gateway_method" "auth_exchange_post" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.auth_exchange.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_exchange_post" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.auth_exchange.id
  http_method             = aws_api_gateway_method.auth_exchange_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.auth_exchange_invoke_arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "auth_exchange" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_exchange_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /auth/device - Parent resource
# ============================================================================

resource "aws_api_gateway_resource" "auth_device" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "device"
}

# ============================================================================
# /auth/device/init - POST
# ============================================================================

resource "aws_api_gateway_resource" "auth_device_init" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.auth_device.id
  path_part   = "init"
}

resource "aws_api_gateway_method" "auth_device_init_post" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.auth_device_init.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_device_init_post" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.auth_device_init.id
  http_method             = aws_api_gateway_method.auth_device_init_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.auth_device_init_invoke_arn
}

resource "aws_lambda_permission" "auth_device_init" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_device_init_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /auth/device/poll - POST
# ============================================================================

resource "aws_api_gateway_resource" "auth_device_poll" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.auth_device.id
  path_part   = "poll"
}

resource "aws_api_gateway_method" "auth_device_poll_post" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.auth_device_poll.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_device_poll_post" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.auth_device_poll.id
  http_method             = aws_api_gateway_method.auth_device_poll_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.auth_device_poll_invoke_arn
}

resource "aws_lambda_permission" "auth_device_poll" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_device_poll_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /publish - POST
# ============================================================================

resource "aws_api_gateway_resource" "publish" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_rest_api.spectrl.root_resource_id
  path_part   = "publish"
}

resource "aws_api_gateway_method" "publish_post" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.publish.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "publish_post" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.publish.id
  http_method             = aws_api_gateway_method.publish_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.publish_spec_invoke_arn
}

resource "aws_lambda_permission" "publish_spec" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.publish_spec_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /search - GET
# ============================================================================

resource "aws_api_gateway_resource" "search" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_rest_api.spectrl.root_resource_id
  path_part   = "search"
}

resource "aws_api_gateway_method" "search_get" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.search.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.querystring.q" = false
  }
}

resource "aws_api_gateway_integration" "search_get" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.search.id
  http_method             = aws_api_gateway_method.search_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.search_specs_invoke_arn
}

resource "aws_lambda_permission" "search_specs" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.search_specs_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /specs/{username}/{specName} - GET
# ============================================================================

resource "aws_api_gateway_resource" "specs" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_rest_api.spectrl.root_resource_id
  path_part   = "specs"
}

resource "aws_api_gateway_resource" "specs_username" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.specs.id
  path_part   = "{username}"
}

resource "aws_api_gateway_resource" "specs_username_specname" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.specs_username.id
  path_part   = "{specName}"
}

resource "aws_api_gateway_method" "get_spec" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.specs_username_specname.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.username" = true
    "method.request.path.specName" = true
  }
}

resource "aws_api_gateway_integration" "get_spec" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.specs_username_specname.id
  http_method             = aws_api_gateway_method.get_spec.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.get_spec_invoke_arn
}

resource "aws_lambda_permission" "get_spec" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.get_spec_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /specs/{username}/{specName}/{version} - DELETE
# ============================================================================

resource "aws_api_gateway_resource" "specs_username_specname_version" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_resource.specs_username_specname.id
  path_part   = "{version}"
}

resource "aws_api_gateway_method" "unpublish_spec" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.specs_username_specname_version.id
  http_method   = "DELETE"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.username" = true
    "method.request.path.specName" = true
    "method.request.path.version"  = true
  }
}

resource "aws_api_gateway_integration" "unpublish_spec" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.specs_username_specname_version.id
  http_method             = aws_api_gateway_method.unpublish_spec.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.unpublish_spec_invoke_arn
}

resource "aws_lambda_permission" "unpublish_spec" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.unpublish_spec_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# /track-download - POST
# ============================================================================

resource "aws_api_gateway_resource" "track_download" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  parent_id   = aws_api_gateway_rest_api.spectrl.root_resource_id
  path_part   = "track-download"
}

resource "aws_api_gateway_method" "track_download_post" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.track_download.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "track_download_post" {
  rest_api_id             = aws_api_gateway_rest_api.spectrl.id
  resource_id             = aws_api_gateway_resource.track_download.id
  http_method             = aws_api_gateway_method.track_download_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.track_download_invoke_arn
}

resource "aws_lambda_permission" "track_download" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.track_download_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.spectrl.execution_arn}/*/*"
}

# ============================================================================
# CORS Configuration - Enable CORS on all endpoints
# ============================================================================

# CORS for /auth/exchange
resource "aws_api_gateway_method" "auth_exchange_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.auth_exchange.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_exchange_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = aws_api_gateway_method.auth_exchange_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "auth_exchange_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = aws_api_gateway_method.auth_exchange_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "auth_exchange_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_exchange.id
  http_method = aws_api_gateway_method.auth_exchange_options.http_method
  status_code = aws_api_gateway_method_response.auth_exchange_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /auth/device/init
resource "aws_api_gateway_method" "auth_device_init_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.auth_device_init.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_device_init_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_device_init.id
  http_method = aws_api_gateway_method.auth_device_init_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "auth_device_init_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_device_init.id
  http_method = aws_api_gateway_method.auth_device_init_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "auth_device_init_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_device_init.id
  http_method = aws_api_gateway_method.auth_device_init_options.http_method
  status_code = aws_api_gateway_method_response.auth_device_init_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /auth/device/poll
resource "aws_api_gateway_method" "auth_device_poll_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.auth_device_poll.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_device_poll_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_device_poll.id
  http_method = aws_api_gateway_method.auth_device_poll_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "auth_device_poll_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_device_poll.id
  http_method = aws_api_gateway_method.auth_device_poll_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "auth_device_poll_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.auth_device_poll.id
  http_method = aws_api_gateway_method.auth_device_poll_options.http_method
  status_code = aws_api_gateway_method_response.auth_device_poll_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /publish
resource "aws_api_gateway_method" "publish_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.publish.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "publish_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.publish.id
  http_method = aws_api_gateway_method.publish_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "publish_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.publish.id
  http_method = aws_api_gateway_method.publish_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "publish_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.publish.id
  http_method = aws_api_gateway_method.publish_options.http_method
  status_code = aws_api_gateway_method_response.publish_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /search
resource "aws_api_gateway_method" "search_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.search.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "search_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.search.id
  http_method = aws_api_gateway_method.search_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "search_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.search.id
  http_method = aws_api_gateway_method.search_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "search_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.search.id
  http_method = aws_api_gateway_method.search_options.http_method
  status_code = aws_api_gateway_method_response.search_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /specs/{username}/{specName}
resource "aws_api_gateway_method" "get_spec_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.specs_username_specname.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_spec_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.specs_username_specname.id
  http_method = aws_api_gateway_method.get_spec_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "get_spec_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.specs_username_specname.id
  http_method = aws_api_gateway_method.get_spec_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "get_spec_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.specs_username_specname.id
  http_method = aws_api_gateway_method.get_spec_options.http_method
  status_code = aws_api_gateway_method_response.get_spec_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /specs/{username}/{specName}/{version}
resource "aws_api_gateway_method" "unpublish_spec_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.specs_username_specname_version.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "unpublish_spec_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.specs_username_specname_version.id
  http_method = aws_api_gateway_method.unpublish_spec_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "unpublish_spec_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.specs_username_specname_version.id
  http_method = aws_api_gateway_method.unpublish_spec_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "unpublish_spec_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.specs_username_specname_version.id
  http_method = aws_api_gateway_method.unpublish_spec_options.http_method
  status_code = aws_api_gateway_method_response.unpublish_spec_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /track-download
resource "aws_api_gateway_method" "track_download_options" {
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  resource_id   = aws_api_gateway_resource.track_download.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "track_download_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.track_download.id
  http_method = aws_api_gateway_method.track_download_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "track_download_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.track_download.id
  http_method = aws_api_gateway_method.track_download_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "track_download_options" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  resource_id = aws_api_gateway_resource.track_download.id
  http_method = aws_api_gateway_method.track_download_options.http_method
  status_code = aws_api_gateway_method_response.track_download_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================================
# Deployment and Stage
# ============================================================================

resource "aws_api_gateway_deployment" "spectrl" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id

  # Force redeployment when any method or integration changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_integration.auth_device_init_post.id,
      aws_api_gateway_integration.auth_device_poll_post.id,
      aws_api_gateway_integration.auth_exchange_post.id,
      aws_api_gateway_integration.publish_post.id,
      aws_api_gateway_integration.search_get.id,
      aws_api_gateway_integration.get_spec.id,
      aws_api_gateway_integration.unpublish_spec.id,
      aws_api_gateway_integration.track_download_post.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.auth_device_init_post,
    aws_api_gateway_integration.auth_device_poll_post,
    aws_api_gateway_integration.auth_exchange_post,
    aws_api_gateway_integration.publish_post,
    aws_api_gateway_integration.search_get,
    aws_api_gateway_integration.get_spec,
    aws_api_gateway_integration.unpublish_spec,
    aws_api_gateway_integration.track_download_post,
  ]
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.spectrl.id
  rest_api_id   = aws_api_gateway_rest_api.spectrl.id
  stage_name    = "prod"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================================================
# Rate Limiting - 100 requests per minute per IP
# ============================================================================

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.spectrl.id
  stage_name  = aws_api_gateway_stage.prod.stage_name
  method_path = "*/*"

  settings {
    throttling_rate_limit  = 100
    throttling_burst_limit = 200
  }
}
