# API Gateway Rate Limiting

## Current Configuration

The API Gateway is configured with the following throttling settings:

- **Rate Limit**: 100 requests per second (global)
- **Burst Limit**: 200 requests (global)

These settings are applied at the **stage level** using `aws_api_gateway_method_settings`.

## Important Note: Global vs Per-IP Rate Limiting

**The current configuration applies rate limiting GLOBALLY across all clients, NOT per IP address.**

AWS API Gateway's built-in throttling (`throttling_rate_limit` and `throttling_burst_limit`) is applied at the account/API level, meaning:

- All requests to the API share the same rate limit pool
- A single client can consume the entire rate limit
- This does NOT provide per-IP protection against abuse

## Per-IP Rate Limiting with AWS WAF

To implement true per-IP rate limiting, you need to use **AWS WAF (Web Application Firewall)**:

### WAF Rate-Based Rule Configuration

```hcl
resource "aws_wafv2_web_acl" "api_rate_limit" {
  name  = "spectrl-api-rate-limit"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitPerIP"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 100  # requests per 5-minute window
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitPerIP"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "APIRateLimit"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "api_gateway" {
  resource_arn = aws_api_gateway_stage.prod.arn
  web_acl_arn  = aws_wafv2_web_acl.api_rate_limit.arn
}
```

### WAF Pricing Considerations

AWS WAF has additional costs:

- **Web ACL**: $5.00 per month
- **Rule**: $1.00 per month per rule
- **Requests**: $0.60 per million requests

For a low-traffic API, this adds approximately $6-10/month in additional costs.

## Recommendation

For the Spectrl public registry:

1. **Current Setup (Global Rate Limiting)**: Acceptable for MVP/low-traffic scenarios
   - Protects against accidental DDoS from misconfigured clients
   - No additional cost
   - Does not protect against targeted abuse from single IP

2. **Future Enhancement (Per-IP with WAF)**: Implement when traffic increases
   - True per-IP protection
   - Better abuse prevention
   - Additional monthly cost (~$6-10)

## Monitoring

Monitor rate limiting effectiveness using CloudWatch metrics:

- `Count` - Total number of requests
- `4XXError` - Client errors (including 429 Too Many Requests)
- `5XXError` - Server errors

If you see frequent 429 errors from legitimate users, consider increasing the rate limits or implementing per-IP limiting with WAF.

## Testing Rate Limiting

To test the current global rate limiting:

```bash
# Send rapid requests to trigger rate limiting
for i in {1..150}; do
  curl -X POST https://api.spectrl.dev/track-download \
    -H "Content-Type: application/json" \
    -d '{"username":"test","specName":"test","version":"1.0.0"}' &
done
wait

# You should see some requests return 429 Too Many Requests
```

## References

- [AWS API Gateway Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- [AWS WAF Rate-Based Rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html)
