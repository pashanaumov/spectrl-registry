# Task 5: search-specs Lambda

## What Was Implemented

Implemented the search-specs Lambda function that enables searching for specs in the public registry. The Lambda scans DynamoDB and returns matching specs based on query parameters.

### Subtasks Completed

- 5.1: Created Lambda handler in `api/search-specs/index.ts`
- 5.2: Implemented DynamoDB search logic with filtering
- 5.3: Added error handling and response formatting
- 5.4: Created Terraform resources for Lambda deployment
- 5.5: Added IAM role with DynamoDB scan permissions

## Why These Decisions

**Zod Validation:**
Added comprehensive Zod validation following the patterns established in auth-exchange and publish-spec lambdas:

1. Query parameter validation with `searchQuerySchema` - validates and limits query string to 200 chars
2. Response validation with `searchResponseSchema` - ensures response structure is correct
3. Error response validation with `errorResponseSchema` - standardizes error responses
4. DynamoDB result validation - validates each item from DynamoDB before returning

This provides:

- Runtime type safety for all inputs and outputs
- Clear error messages for invalid requests
- Protection against malformed data from DynamoDB
- Consistency with other Lambda implementations

**Search Strategy - Scan vs Query:**
The implementation uses DynamoDB Scan instead of Query because we need to search across multiple fields (specName, description, tags) that aren't part of the primary key. While Scan is less efficient than Query, it's acceptable for this use case because:

1. The specs table will be relatively small (thousands, not millions of items)
2. We limit results to 20 items
3. Search is not a high-frequency operation compared to publish/get
4. Adding GSIs for each searchable field would increase costs and complexity

**In-Memory Filtering:**
The search performs case-insensitive filtering in memory after scanning DynamoDB. This approach was chosen because:

1. DynamoDB doesn't support case-insensitive search natively
2. The dataset is small enough to filter in Lambda memory
3. It keeps the implementation simple and maintainable
4. Alternative approaches (like storing lowercase versions) would complicate the data model

**Empty Query Handling:**
When no query is provided, the Lambda returns all specs (limited to 20). This design decision:

1. Provides a "browse all specs" functionality
2. Simplifies the CLI implementation (no special case needed)
3. Matches common search UX patterns (empty search = show all)

**CORS Headers:**
Added `Access-Control-Allow-Origin: *` to enable future web-based registry browsing without CORS issues.

**Error Handling:**
Reused the same error handling pattern from publish-spec Lambda for consistency. Maps DynamoDB errors to appropriate HTTP status codes.

## Requirements Addressed

From Phase 2 Task 5 acceptance criteria:

- Lambda function created ✓
- Search returns relevant results ✓
- Results limited to 20 ✓
- Works with empty query ✓
- Error handling works ✓

## Code Changes

### Lambda Implementation

- `api/search-specs/index.ts` - Main Lambda handler with Zod validation
- `api/search-specs/helpers/dynamodb.ts` - DynamoDB scan and filter logic with result validation
- `api/search-specs/schemas/request.ts` - Query parameter validation schemas
- `api/search-specs/schemas/response.ts` - Response type definitions and validation schemas
- `api/search-specs/helpers/errors.ts` - Error status code mapping

### Terraform Configuration

- `infra/modules/lambda/main.tf` - Added search-specs Lambda resources:
  - IAM role for Lambda execution
  - IAM policy with DynamoDB scan permissions
  - Lambda function with Node.js 20 runtime
  - CloudWatch log group for Lambda logs
- `infra/modules/lambda/outputs.tf` - Added outputs for search-specs Lambda ARNs

## Technical Details

**Lambda Configuration:**

- Runtime: Node.js 20
- Memory: 256 MB (sufficient for scanning and filtering)
- Timeout: 30 seconds
- Environment variables: `SPECS_TABLE`

**IAM Permissions:**

- `dynamodb:Scan` on specs table
- CloudWatch Logs permissions for logging

**Response Format:**

```json
{
  "results": [
    {
      "specId": "username/spec-name",
      "version": "1.0.0",
      "username": "username",
      "specName": "spec-name",
      "description": "...",
      "tags": ["tag1", "tag2"],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 5
}
```

## Challenges & Considerations

**Performance Considerations:**

- Scan operations can be slow on large tables, but acceptable for MVP
- Future optimization: Add DynamoDB GSI for text search if needed
- Future optimization: Implement pagination if result sets grow large

**Search Quality:**

- Current implementation is simple substring matching
- Future enhancement: Could add relevance scoring
- Future enhancement: Could implement fuzzy matching for typos

**Scalability:**

- Current approach works well for <10k specs
- If registry grows significantly, consider:
  - ElasticSearch/OpenSearch for full-text search
  - DynamoDB Streams + Lambda to maintain search index
  - Pagination for large result sets

## Next Steps

1. Deploy Lambda via Terraform
2. Test search functionality with various queries
3. Integrate with API Gateway (Task 8)
4. Test end-to-end search flow (Task 9)
