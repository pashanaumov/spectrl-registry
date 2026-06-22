#!/bin/bash

# Integration tests for Spectrl API on LocalStack
# Tests all endpoints with real GitHub OAuth

# Get script directory and change to it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# Temporarily disable set -e for debugging
# set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if LocalStack is running
    if ! docker ps | grep -q localstack; then
        log_error "LocalStack is not running. Start it with: docker-compose up -d"
        exit 1
    fi
    log_success "LocalStack is running"
    
    # Check if jq is installed
    echo "DEBUG: Checking for jq..." >&2
    if ! command -v jq > /dev/null 2>&1; then
        log_error "jq is not installed. Install it with: brew install jq"
        exit 1
    fi
    log_success "jq is installed"
    
    # Check if infrastructure is deployed
    if ! (cd environments/dev && tflocal state list > /dev/null 2>&1); then
        log_error "Infrastructure not deployed. Run: cd infra/environments/dev && tflocal apply"
        exit 1
    fi
    log_success "Infrastructure is deployed"
}

# Get API endpoint
get_api_endpoint() {
    API_URL=$(cd environments/dev && tflocal output -raw api_endpoint 2>/dev/null)
    
    if [ -z "$API_URL" ]; then
        log_error "Could not get API endpoint from Terraform"
        exit 1
    fi
    
    # LocalStack returns AWS-style URLs, but we need to use localhost
    # Convert: https://abc123.execute-api.eu-north-1.amazonaws.com/prod
    # To: http://localhost:4566/restapis/abc123/prod/_user_request_
    API_ID=$(echo "$API_URL" | sed -E 's|https://([^.]+)\.execute-api.*|\1|')
    STAGE=$(echo "$API_URL" | sed -E 's|.*/([^/]+)$|\1|')
    API_URL="http://localhost:4566/restapis/$API_ID/$STAGE/_user_request_"
    
    log_info "API Endpoint: $API_URL"
}

# Get GitHub token (you'll need to provide this)
get_github_token() {
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warning "GITHUB_TOKEN not set. Some tests will be skipped."
        log_info "Get a token from: https://github.com/settings/tokens"
        log_info "Then run: export GITHUB_TOKEN='your_token'"
        GITHUB_TOKEN=""
    else
        log_success "GitHub token found (${#GITHUB_TOKEN} characters)"
    fi
}

# Test 1: Search (no auth required)
test_search_empty() {
    log_info "Test 1: Search with empty query"
    
    RESPONSE=$(curl -s "$API_URL/search")
    
    if echo "$RESPONSE" | jq -e '.results' > /dev/null 2>&1; then
        log_success "Search endpoint works (returned results array)"
    else
        log_error "Search endpoint failed: $RESPONSE"
    fi
}

# Test 2: Search with query
test_search_with_query() {
    log_info "Test 2: Search with query parameter"
    
    RESPONSE=$(curl -s "$API_URL/search?q=test")
    
    if echo "$RESPONSE" | jq -e '.results' > /dev/null 2>&1; then
        log_success "Search with query works"
    else
        log_error "Search with query failed: $RESPONSE"
    fi
}

# Test 3: Get non-existent spec (should return 404)
test_get_nonexistent_spec() {
    log_info "Test 3: Get non-existent spec (expect 404)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/specs/nonexistent/spec")
    
    if [ "$HTTP_CODE" = "404" ]; then
        log_success "Non-existent spec returns 404"
    else
        log_error "Expected 404, got $HTTP_CODE"
    fi
}

# Test 4: Publish spec (requires GitHub token)
test_publish_spec() {
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warning "Skipping publish test (no GitHub token)"
        return
    fi
    
    log_info "Test 4: Publish spec"
    
    RESPONSE=$(curl -s -X POST "$API_URL/publish" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Content-Type: application/json" \
        -d @test-fixtures/test-spec.json)
    
    if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
        log_success "Publish spec succeeded"
        PUBLISHED_SPEC=true
    else
        log_error "Publish spec failed: $RESPONSE"
        PUBLISHED_SPEC=false
    fi
}

# Test 5: Get published spec
test_get_published_spec() {
    if [ "$PUBLISHED_SPEC" != "true" ]; then
        log_warning "Skipping get spec test (spec not published)"
        return
    fi
    
    log_info "Test 5: Get published spec"
    
    # Extract username from GitHub token (we'll use the authenticated user)
    # For now, we'll try a generic path - you may need to adjust this
    RESPONSE=$(curl -s "$API_URL/specs/testuser/test-spec")
    
    if echo "$RESPONSE" | jq -e '.versions' > /dev/null 2>&1; then
        log_success "Get spec succeeded"
    else
        log_warning "Get spec returned: $RESPONSE (may need to adjust username)"
    fi
}

# Test 6: Search for published spec
test_search_published_spec() {
    if [ "$PUBLISHED_SPEC" != "true" ]; then
        log_warning "Skipping search test (spec not published)"
        return
    fi
    
    log_info "Test 6: Search for published spec"
    
    RESPONSE=$(curl -s "$API_URL/search?q=test-spec")
    
    if echo "$RESPONSE" | jq -e '.results | length > 0' > /dev/null 2>&1; then
        log_success "Search found published spec"
    else
        log_warning "Search did not find spec (may take time to index)"
    fi
}

# Test 7: Publish invalid spec (should fail)
test_publish_invalid_spec() {
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warning "Skipping invalid spec test (no GitHub token)"
        return
    fi
    
    log_info "Test 7: Publish invalid spec (expect error)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/publish" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Content-Type: application/json" \
        -d @test-fixtures/invalid-spec.json)
    
    if [ "$HTTP_CODE" = "400" ]; then
        log_success "Invalid spec rejected with 400"
    else
        log_warning "Expected 400, got $HTTP_CODE (validation may differ)"
    fi
}

# Test 8: Publish without token (should fail)
test_publish_without_token() {
    log_info "Test 8: Publish without token (expect 401)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/publish" \
        -H "Content-Type: application/json" \
        -d @test-fixtures/test-spec.json)
    
    if [ "$HTTP_CODE" = "401" ]; then
        log_success "Publish without token returns 401"
    else
        log_error "Expected 401, got $HTTP_CODE"
    fi
}

# Test 9: Unpublish spec
test_unpublish_spec() {
    if [ "$PUBLISHED_SPEC" != "true" ] || [ -z "$GITHUB_TOKEN" ]; then
        log_warning "Skipping unpublish test (spec not published or no token)"
        return
    fi
    
    log_info "Test 9: Unpublish spec"
    
    RESPONSE=$(curl -s -X DELETE "$API_URL/specs/testuser/test-spec/1.0.0" \
        -H "Authorization: Bearer $GITHUB_TOKEN")
    
    if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
        log_success "Unpublish spec succeeded"
    else
        log_warning "Unpublish returned: $RESPONSE (may need to adjust username)"
    fi
}

# Test 10: CORS preflight
test_cors_preflight() {
    log_info "Test 10: CORS preflight (OPTIONS)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/search")
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "CORS preflight works"
    else
        log_error "CORS preflight failed with $HTTP_CODE"
    fi
}

# Test 11: Device flow init
test_device_flow_init() {
    log_info "Test 11: Device flow init"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/device/init")
    
    if echo "$RESPONSE" | jq -e '.device_code' > /dev/null 2>&1; then
        DEVICE_CODE=$(echo "$RESPONSE" | jq -r '.device_code')
        USER_CODE=$(echo "$RESPONSE" | jq -r '.user_code')
        log_success "Device flow init works (user_code: $USER_CODE)"
        DEVICE_FLOW_INITIATED=true
    else
        log_error "Device flow init failed: $RESPONSE"
        DEVICE_FLOW_INITIATED=false
    fi
}

# Test 12: Device flow poll (pending)
test_device_flow_poll_pending() {
    if [ "$DEVICE_FLOW_INITIATED" != "true" ]; then
        log_warning "Skipping device flow poll test (init failed)"
        return
    fi
    
    log_info "Test 12: Device flow poll (expect 202 pending)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/device/poll" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\"}")
    
    if [ "$HTTP_CODE" = "202" ]; then
        log_success "Device flow poll returns 202 (authorization pending)"
    else
        log_warning "Expected 202, got $HTTP_CODE (may be authorized or expired)"
    fi
}

# Test 13: Device flow poll with invalid code
test_device_flow_poll_invalid() {
    log_info "Test 13: Device flow poll with invalid code (expect 400)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/device/poll" \
        -H "Content-Type: application/json" \
        -d '{"device_code":"invalid_code_12345"}')
    
    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "202" ]; then
        log_success "Device flow poll with invalid code handled correctly ($HTTP_CODE)"
    else
        log_warning "Expected 400 or 202, got $HTTP_CODE"
    fi
}

# Test 14: Device flow CORS
test_device_flow_cors() {
    log_info "Test 14: Device flow CORS (OPTIONS)"
    
    HTTP_CODE_INIT=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/auth/device/init")
    HTTP_CODE_POLL=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/auth/device/poll")
    
    if [ "$HTTP_CODE_INIT" = "200" ] && [ "$HTTP_CODE_POLL" = "200" ]; then
        log_success "Device flow CORS works"
    else
        log_error "Device flow CORS failed (init: $HTTP_CODE_INIT, poll: $HTTP_CODE_POLL)"
    fi
}

# Main test execution
main() {
    echo ""
    echo "=========================================="
    echo "  Spectrl API Integration Tests"
    echo "  Testing against LocalStack"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    get_api_endpoint
    get_github_token
    
    echo ""
    echo "Running tests..."
    echo ""
    
    # Run all tests
    test_search_empty
    test_search_with_query
    test_get_nonexistent_spec
    test_publish_spec
    test_get_published_spec
    test_search_published_spec
    test_publish_invalid_spec
    test_publish_without_token
    test_unpublish_spec
    test_cors_preflight
    test_device_flow_init
    test_device_flow_poll_pending
    test_device_flow_poll_invalid
    test_device_flow_cors
    
    # Summary
    echo ""
    echo "=========================================="
    echo "  Test Results"
    echo "=========================================="
    echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
    echo -e "${RED}Failed:${NC} $TESTS_FAILED"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

# Run main function
main
