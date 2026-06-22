#!/bin/bash

# Integration test script for Spectrl infrastructure
# Tests S3, DynamoDB, and Secrets Manager
# Cleans up test data after completion

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-prod}  # Default to prod, can pass 'dev' as argument
TEST_PREFIX="integration-test-$(date +%s)"

if [ "$ENVIRONMENT" = "dev" ]; then
    AWS_CMD="awslocal"
    # Get bucket name from Terraform output for dev
    cd environments/dev
    BUCKET_NAME=$(tflocal output -raw storage_bucket_name 2>/dev/null || echo "spectrl-registry-dev")
    SPECS_TABLE=$(tflocal output -raw specs_table_name 2>/dev/null || echo "spectrl-specs-dev")
    USERS_TABLE=$(tflocal output -raw users_table_name 2>/dev/null || echo "spectrl-users-dev")
    SECRET_NAME=$(tflocal output -raw github_oauth_secret_name 2>/dev/null || echo "spectrl/github-oauth-dev")
    cd ../..
else
    AWS_CMD="aws"
    # Get bucket name from Terraform output for prod
    cd environments/prod
    BUCKET_NAME=$(terraform output -raw storage_bucket_name 2>/dev/null || echo "spectrl-registry-prod")
    SPECS_TABLE=$(terraform output -raw specs_table_name 2>/dev/null || echo "spectrl-specs-prod")
    USERS_TABLE=$(terraform output -raw users_table_name 2>/dev/null || echo "spectrl-users-prod")
    SECRET_NAME=$(terraform output -raw github_oauth_secret_name 2>/dev/null || echo "spectrl/github-oauth-prod")
    cd ../..
fi

echo -e "${YELLOW}Running integration tests for ${ENVIRONMENT} environment...${NC}\n"

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test data...${NC}"
    
    # Clean up S3 test file
    $AWS_CMD s3 rm "s3://${BUCKET_NAME}/specs/test/${TEST_PREFIX}.txt" 2>/dev/null || true
    
    # Clean up DynamoDB test data
    $AWS_CMD dynamodb delete-item \
        --table-name "$SPECS_TABLE" \
        --key "{\"specId\": {\"S\": \"${TEST_PREFIX}/test-spec\"}, \"version\": {\"S\": \"1.0.0\"}}" \
        2>/dev/null || true
    
    $AWS_CMD dynamodb delete-item \
        --table-name "$USERS_TABLE" \
        --key "{\"githubId\": {\"N\": \"999999\"}}" \
        2>/dev/null || true
    
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Register cleanup to run on exit
trap cleanup EXIT

# Test 1: S3 Upload
echo -e "${YELLOW}Test 1: S3 Upload${NC}"
echo "test content from integration test" > /tmp/${TEST_PREFIX}.txt
if $AWS_CMD s3 cp /tmp/${TEST_PREFIX}.txt "s3://${BUCKET_NAME}/specs/test/${TEST_PREFIX}.txt"; then
    echo -e "${GREEN}✓ S3 upload successful${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ S3 upload failed${NC}\n"
    ((TESTS_FAILED++))
fi
rm /tmp/${TEST_PREFIX}.txt

# Test 2: S3 Download
echo -e "${YELLOW}Test 2: S3 Download${NC}"
if $AWS_CMD s3 cp "s3://${BUCKET_NAME}/specs/test/${TEST_PREFIX}.txt" /tmp/${TEST_PREFIX}-download.txt; then
    CONTENT=$(cat /tmp/${TEST_PREFIX}-download.txt)
    if [ "$CONTENT" = "test content from integration test" ]; then
        echo -e "${GREEN}✓ S3 download successful and content matches${NC}\n"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ S3 download content mismatch${NC}\n"
        ((TESTS_FAILED++))
    fi
    rm /tmp/${TEST_PREFIX}-download.txt
else
    echo -e "${RED}✗ S3 download failed${NC}\n"
    ((TESTS_FAILED++))
fi

# Test 3: DynamoDB Write (Specs Table)
echo -e "${YELLOW}Test 3: DynamoDB Write (Specs Table)${NC}"
if $AWS_CMD dynamodb put-item \
    --table-name "$SPECS_TABLE" \
    --item "{
        \"specId\": {\"S\": \"${TEST_PREFIX}/test-spec\"},
        \"version\": {\"S\": \"1.0.0\"},
        \"username\": {\"S\": \"test-user\"},
        \"createdAt\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},
        \"allSpecs\": {\"S\": \"ALL\"},
        \"description\": {\"S\": \"Integration test spec\"}
    }"; then
    echo -e "${GREEN}✓ DynamoDB specs table write successful${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ DynamoDB specs table write failed${NC}\n"
    ((TESTS_FAILED++))
fi

# Test 4: DynamoDB Read (Specs Table)
echo -e "${YELLOW}Test 4: DynamoDB Read (Specs Table)${NC}"
if $AWS_CMD dynamodb get-item \
    --table-name "$SPECS_TABLE" \
    --key "{\"specId\": {\"S\": \"${TEST_PREFIX}/test-spec\"}, \"version\": {\"S\": \"1.0.0\"}}" \
    --output json | grep -q "test-user"; then
    echo -e "${GREEN}✓ DynamoDB specs table read successful${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ DynamoDB specs table read failed${NC}\n"
    ((TESTS_FAILED++))
fi

# Test 5: DynamoDB Write (Users Table)
echo -e "${YELLOW}Test 5: DynamoDB Write (Users Table)${NC}"
if $AWS_CMD dynamodb put-item \
    --table-name "$USERS_TABLE" \
    --item "{
        \"githubId\": {\"N\": \"999999\"},
        \"username\": {\"S\": \"test-integration-user\"},
        \"email\": {\"S\": \"test@example.com\"},
        \"createdAt\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }"; then
    echo -e "${GREEN}✓ DynamoDB users table write successful${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ DynamoDB users table write failed${NC}\n"
    ((TESTS_FAILED++))
fi

# Test 6: DynamoDB Read (Users Table)
echo -e "${YELLOW}Test 6: DynamoDB Read (Users Table)${NC}"
if $AWS_CMD dynamodb get-item \
    --table-name "$USERS_TABLE" \
    --key "{\"githubId\": {\"N\": \"999999\"}}" \
    --output json | grep -q "test-integration-user"; then
    echo -e "${GREEN}✓ DynamoDB users table read successful${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ DynamoDB users table read failed${NC}\n"
    ((TESTS_FAILED++))
fi

# Test 7: Secrets Manager
echo -e "${YELLOW}Test 7: Secrets Manager${NC}"
if $AWS_CMD secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --output json | grep -q "clientId"; then
    echo -e "${GREEN}✓ Secrets Manager read successful${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Secrets Manager read failed${NC}\n"
    ((TESTS_FAILED++))
fi

# Summary
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}Integration Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
echo -e "${YELLOW}========================================${NC}\n"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed ✗${NC}"
    exit 1
fi
