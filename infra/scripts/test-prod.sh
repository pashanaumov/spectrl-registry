#!/bin/bash

# Integration tests for Spectrl API on AWS Production
# Tests all endpoints with real GitHub OAuth

# Get script directory and change to it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

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
    
    # Check if jq is installed
    if ! command -v jq > /dev/null 2>&1; then
        log_error "jq is not installed. Install it with: brew install jq"
        exit 1
    fi
    log_success "jq is installed"
    
    # Check if infrastructure is deployed
    if ! (cd environments/prod && terraform state list > /dev/null 2>&1); then
        log_error "Infrastructure not deployed. Run: cd infra/environments/prod && terraform apply"
        exit 1
    fi
    log_success "Infrastructure is deployed to AWS"
}

# Get API endpoint
get_api_endpoint() {
    API_URL=$(cd environments/prod && terraform output -raw api_endpoint 2>/dev/null)
    
    if [ -z "$API_URL" ]; then
        log_error "Could not get API endpoint from Terraform"
        exit 1
    fi
    
    log_info "API Endpoint: $API_URL"
}

# Get GitHub token
get_github_token() {
    if [ -z "$GITHUB_TOKEN" ]; then
        log_error "GITHUB_TOKEN not set. This is required for testing."
        log_info ""
        log_info "This should be a personal access token (not OAuth credentials)."
        log_info "Get a token from: https://github.com/settings/tokens"
        log_info "Required scopes: read:user"
        log_info ""
        log_info "Then run: export GITHUB_TOKEN='your_token'"
        log_info ""
        log_info "Note: This is different from the OAuth credentials in Secrets Manager."
        log_info "OAuth credentials are for the auth flow, this token is for testing."
        exit 1
    else
        log_success "GitHub token found (${#GITHUB_TOKEN} characters)"
    fi
}

# Get authenticated username
get_username() {
    log_info "Getting authenticated username from GitHub..."
    USERNAME=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | jq -r '.login')
    
    if [ -z "$USERNAME" ] || [ "$USERNAME" = "null" ]; then
        log_error "Could not get username from GitHub. Check your token."
        exit 1
    fi
    
    log_success "Authenticated as: $USERNAME"
}

# Test 1: Search (no auth required)
test_search_empty() {
    log_info "Test 1: Search with empty query"
    
    RESPONSE=$(curl -s "$API_URL/search")
    
    if echo "$RESPONSE" | jq -e '.results' > /dev/null 2>&1; then
        COUNT=$(echo "$RESPONSE" | jq -r '.count')
        log_success "Search endpoint works (found $COUNT specs)"
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
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/specs/nonexistent/spec-that-does-not-exist")
    
    if [ "$HTTP_CODE" = "404" ]; then
        log_success "Non-existent spec returns 404"
    else
        log_error "Expected 404, got $HTTP_CODE"
    fi
}

# Test 4: Publish spec
test_publish_spec() {
    log_info "Test 4: Publish test spec"
    
    RESPONSE=$(curl -s -X POST "$API_URL/publish" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Content-Type: application/json" \
        -d @test-fixtures/test-spec.json)
    
    if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
        MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
        log_success "Publish succeeded: $MESSAGE"
        PUBLISHED_SPEC=true
    else
        log_error "Publish failed: $RESPONSE"
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
    
    RESPONSE=$(curl -s "$API_URL/specs/$USERNAME/test-spec")
    
    if echo "$RESPONSE" | jq -e '.versions' > /dev/null 2>&1; then
        VERSION_COUNT=$(echo "$RESPONSE" | jq -r '.versions | length')
        log_success "Get spec succeeded (found $VERSION_COUNT version(s))"
    else
        log_error "Get spec failed: $RESPONSE"
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
        log_warning "Search did not find spec: $RESPONSE"
    fi
}

# Test 7: Publish invalid spec (should fail)
test_publish_invalid_spec() {
    log_info "Test 7: Publish invalid spec (expect 400)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/publish" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Content-Type: application/json" \
        -d @test-fixtures/invalid-spec.json)
    
    if [ "$HTTP_CODE" = "400" ]; then
        log_success "Invalid spec rejected with 400"
    else
        log_warning "Expected 400, got $HTTP_CODE"
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
    if [ "$PUBLISHED_SPEC" != "true" ]; then
        log_warning "Skipping unpublish test (spec not published)"
        return
    fi
    
    log_info "Test 9: Unpublish test spec"
    
    RESPONSE=$(curl -s -X DELETE "$API_URL/specs/$USERNAME/test-spec/1.0.0" \
        -H "Authorization: Bearer $GITHUB_TOKEN")
    
    if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
        MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
        log_success "Unpublish succeeded: $MESSAGE"
    else
        log_error "Unpublish failed: $RESPONSE"
    fi
}

# Test 10: Verify unpublish (should return 404)
test_verify_unpublish() {
    if [ "$PUBLISHED_SPEC" != "true" ]; then
        log_warning "Skipping verify unpublish test (spec not published)"
        return
    fi
    
    log_info "Test 10: Verify spec was unpublished (expect 404)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/specs/$USERNAME/test-spec")
    
    if [ "$HTTP_CODE" = "404" ]; then
        log_success "Spec successfully deleted (404)"
    else
        log_warning "Expected 404, got $HTTP_CODE (spec may still exist)"
    fi
}

# Test 11: CORS preflight
test_cors_preflight() {
    log_info "Test 11: CORS preflight (OPTIONS)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/search")
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "CORS preflight works"
    else
        log_error "CORS preflight failed with $HTTP_CODE"
    fi
}

# Test 12: Device flow init
test_device_flow_init() {
    log_info "Test 12: Device flow init"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/device/init")
    
    if echo "$RESPONSE" | jq -e '.device_code' > /dev/null 2>&1; then
        DEVICE_CODE=$(echo "$RESPONSE" | jq -r '.device_code')
        USER_CODE=$(echo "$RESPONSE" | jq -r '.user_code')
        VERIFICATION_URI=$(echo "$RESPONSE" | jq -r '.verification_uri')
        EXPIRES_IN=$(echo "$RESPONSE" | jq -r '.expires_in')
        log_success "Device flow init works"
        log_info "  User code: $USER_CODE"
        log_info "  Verification URI: $VERIFICATION_URI"
        log_info "  Expires in: ${EXPIRES_IN}s"
        DEVICE_FLOW_INITIATED=true
    else
        log_error "Device flow init failed: $RESPONSE"
        DEVICE_FLOW_INITIATED=false
    fi
}

# Test 13: Device flow poll (pending)
test_device_flow_poll_pending() {
    if [ "$DEVICE_FLOW_INITIATED" != "true" ]; then
        log_warning "Skipping device flow poll test (init failed)"
        return
    fi
    
    log_info "Test 13: Device flow poll (expect 202 pending)"
    
    RESPONSE=$(curl -s -X POST "$API_URL/auth/device/poll" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\"}")
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/device/poll" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\"}")
    
    if [ "$HTTP_CODE" = "202" ]; then
        STATUS=$(echo "$RESPONSE" | jq -r '.status')
        log_success "Device flow poll returns 202 (status: $STATUS)"
    else
        log_warning "Expected 202, got $HTTP_CODE (may be authorized or expired)"
    fi
}

# Test 14: Device flow poll with invalid code
test_device_flow_poll_invalid() {
    log_info "Test 14: Device flow poll with invalid code (expect 400)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/device/poll" \
        -H "Content-Type: application/json" \
        -d '{"device_code":"invalid_code_12345"}')
    
    if [ "$HTTP_CODE" = "400" ]; then
        log_success "Device flow poll with invalid code returns 400"
    else
        log_warning "Expected 400, got $HTTP_CODE"
    fi
}

# Test 15: Device flow poll without device_code
test_device_flow_poll_missing_code() {
    log_info "Test 15: Device flow poll without device_code (expect 400)"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/device/poll" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    if [ "$HTTP_CODE" = "400" ]; then
        log_success "Device flow poll without device_code returns 400"
    else
        log_error "Expected 400, got $HTTP_CODE"
    fi
}

# Test 16: Device flow CORS
test_device_flow_cors() {
    log_info "Test 16: Device flow CORS (OPTIONS)"
    
    HTTP_CODE_INIT=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/auth/device/init")
    HTTP_CODE_POLL=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/auth/device/poll")
    
    if [ "$HTTP_CODE_INIT" = "200" ] && [ "$HTTP_CODE_POLL" = "200" ]; then
        log_success "Device flow CORS works"
    else
        log_error "Device flow CORS failed (init: $HTTP_CODE_INIT, poll: $HTTP_CODE_POLL)"
    fi
}

# Test 17: Complete device flow (manual)
test_device_flow_complete() {
    if [ "$DEVICE_FLOW_INITIATED" != "true" ]; then
        log_warning "Skipping complete device flow test (init failed)"
        return
    fi
    
    log_info "Test 17: Complete device flow (manual authorization)"
    log_warning "This test requires manual authorization on GitHub"
    log_info ""
    log_info "To complete this test:"
    log_info "  1. Visit: $VERIFICATION_URI"
    log_info "  2. Enter code: $USER_CODE"
    log_info "  3. Authorize the application"
    log_info ""
    log_info "Press Enter to skip, or wait 30 seconds for polling..."
    
    # Poll for 30 seconds (6 attempts with 5 second intervals)
    for i in {1..6}; do
        sleep 5
        
        RESPONSE=$(curl -s -X POST "$API_URL/auth/device/poll" \
            -H "Content-Type: application/json" \
            -d "{\"device_code\":\"$DEVICE_CODE\"}")
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/device/poll" \
            -H "Content-Type: application/json" \
            -d "{\"device_code\":\"$DEVICE_CODE\"}")
        
        if [ "$HTTP_CODE" = "200" ]; then
            TOKEN=$(echo "$RESPONSE" | jq -r '.token')
            AUTH_USERNAME=$(echo "$RESPONSE" | jq -r '.username')
            log_success "Device flow completed! Authenticated as: $AUTH_USERNAME"
            log_info "  Token: ${TOKEN:0:20}..."
            return
        fi
    done
    
    log_warning "Device flow not completed (no manual authorization)"
}

# Main test execution
main() {
    echo ""
    echo "=========================================="
    echo "  Spectrl API Integration Tests"
    echo "  Testing against AWS Production"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    get_api_endpoint
    get_github_token
    get_username
    
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
    test_verify_unpublish
    test_cors_preflight
    test_device_flow_init
    test_device_flow_poll_pending
    test_device_flow_poll_invalid
    test_device_flow_poll_missing_code
    test_device_flow_cors
    test_device_flow_complete
    
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
