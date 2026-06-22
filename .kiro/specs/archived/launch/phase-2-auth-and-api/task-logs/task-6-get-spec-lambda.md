# Task 6: get-spec Lambda

## What Was Implemented

Implemented the get-spec Lambda function that retrieves all versions of a specific spec from DynamoDB. This Lambda uses efficient Query operations to fetch spec metadata.

### Subtasks Completed

- 6.1: Created Lambda handler in `api/get-spec/index.ts`
- 6.2: Implemented DynamoDB Query logic for retrieving spec versions
- 6.3: Added comprehensive Zod validation for path parameters and responses
- 6.4: Added error handling for invalid parameters and non-existent specs
- 6.5: Created Terraform resources for Lambda deployment
- 6.6: Added IAM role with DynamoDB Query permissions

## Why These Decisions

**Query vs Scan:**
This Lambda uses DynamoDB Query operation instead of Scan because:

1. We know the exact partition key (specId = "username/spec-name")
2. Query is much more efficient - reads only items with matching partition key
3. Query is faster and cheaper than Scan
4. Query automatically uses the primary key index

See the detailed "DynamoDB Query Patterns" section below for more information.

**Path Parameter Validation:**
Added strict validation for username and specName:

- Username: 1-39 chars, alphanumeric + hyphens (matches GitHub constraints)
- SpecName: 1-100 chars, alphanumeric + hyphens + underscores
- Prevents injection attacks and malformed requests
- Provides clear error messages for invalid inputs

**Sort Order:**
Set `ScanIndexForward: false` to return versions in descending order (newest first). This ensures:

- Latest version appears first in the response
- Consistent ordering across requests
- No need to sort in application code

**Comprehensive Response:**
Returns all metadata for each version including:

- Version number, description, tags
- Creation timestamp
- S3 path for downloading files
- Content hash for verification
- File list
- Download count

**404 Handling:**
Returns 404 when spec doesn't exist (empty results) rather than 200 with empty array. This:

- Follows REST conventions
- Makes it clear the resource doesn't exist
- Helps CLI distinguish between "no versions" and "spec not found"

## Requirements Addressed

From Phase 2 Task 6 acceptance criteria:

- Lambda function created ✓
- Returns all versions of a spec ✓
- Handles non-existent specs gracefully (404) ✓
- Versions sorted correctly (newest first) ✓
- Error handling works ✓

## Code Changes

### Lambda Implementation

- `api/get-spec/index.ts` - Main Lambda handler with full Zod validation
- `api/get-spec/helpers/dynamodb.ts` - DynamoDB Query logic with result validation
- `api/get-spec/schemas/request.ts` - Path parameter validation schemas
- `api/get-spec/schemas/response.ts` - Response type definitions and validation schemas
- `api/get-spec/helpers/errors.ts` - Error status code mapping

### Terraform Configuration

- `infra/modules/lambda/main.tf` - Added get-spec Lambda resources:
  - IAM role for Lambda execution
  - IAM policy with DynamoDB Query permissions (not Scan)
  - Lambda function with Node.js 20 runtime
  - CloudWatch log group for Lambda logs
- `infra/modules/lambda/outputs.tf` - Added outputs for get-spec Lambda ARNs

## Technical Details

**Lambda Configuration:**

- Runtime: Node.js 20
- Memory: 256 MB
- Timeout: 30 seconds
- Environment variables: `SPECS_TABLE`

**IAM Permissions:**

- `dynamodb:Query` on specs table (NOT Scan - more restrictive and efficient)
- CloudWatch Logs permissions for logging

**Request Format:**

```
GET /specs/{username}/{specName}
```

**Response Format:**

```json
{
  "specId": "username/spec-name",
  "versions": [
    {
      "specId": "username/spec-name",
      "version": "1.0.0",
      "username": "username",
      "specName": "spec-name",
      "description": "...",
      "tags": ["tag1", "tag2"],
      "createdAt": "2024-01-01T00:00:00Z",
      "s3Path": "specs/username/spec-name/1.0.0",
      "hash": "sha256...",
      "files": ["file1.md", "file2.md"],
      "downloads": 42
    }
  ]
}
```

## DynamoDB Query Patterns

### Table Structure

The specs table has the following key structure:

- **Partition Key (hash_key)**: `specId` (String) - Format: "username/spec-name"
- **Sort Key (range_key)**: `version` (String) - Format: "1.0.0"

### Query vs Scan: When to Use Each

#### Query Operation (Used in get-spec)

**What it does:**

- Reads items with a specific partition key value
- Optionally filters by sort key range
- Uses the table's primary key or a secondary index

**When to use:**

- You know the exact partition key value
- You want all items with that partition key
- You need efficient, fast lookups

**Example from get-spec:**

```typescript
const command = new QueryCommand({
  TableName: process.env.SPECS_TABLE,
  KeyConditionExpression: 'specId = :specId',
  ExpressionAttributeValues: {
    ':specId': 'username/spec-name',
  },
  ScanIndexForward: false, // Sort descending
});
```

**Performance:**

- ✅ Very fast - only reads items with matching partition key
- ✅ Cheap - only pays for items read
- ✅ Scales well - performance doesn't degrade with table size
- ✅ Predictable latency - typically 10-50ms

**Cost:**

- Reads only the items that match the partition key
- If spec has 5 versions, reads 5 items
- Much cheaper than Scan

#### Scan Operation (Used in search-specs)

**What it does:**

- Reads every item in the table
- Applies filter expression after reading
- No index required

**When to use:**

- You need to search across multiple partition keys
- You don't know the partition key
- You need to filter on non-key attributes

**Example from search-specs:**

```typescript
const command = new ScanCommand({
  TableName: process.env.SPECS_TABLE,
  Limit: 100, // Limit items scanned
});
// Then filter in memory for case-insensitive search
```

**Performance:**

- ⚠️ Slower - reads many items
- ⚠️ Expensive - pays for all items scanned
- ⚠️ Doesn't scale - gets slower as table grows
- ⚠️ Variable latency - depends on table size

**Cost:**

- Reads items up to the Limit (or all items if no limit)
- If table has 1000 items and Limit is 100, reads 100 items
- More expensive than Query

### Comparison Table

| Feature                    | Query                      | Scan                    |
| -------------------------- | -------------------------- | ----------------------- |
| **Requires partition key** | Yes                        | No                      |
| **Speed**                  | Fast (10-50ms)             | Slow (100ms-seconds)    |
| **Cost**                   | Low                        | High                    |
| **Scales with table size** | No                         | Yes (gets slower)       |
| **Use case**               | Known key lookup           | Search/filter           |
| **Example**                | Get all versions of a spec | Search specs by keyword |

### Why get-spec Uses Query

1. **We know the partition key**: The specId is constructed from path parameters (username/specName)
2. **Efficiency**: Query only reads items for that specific spec
3. **Performance**: Consistent fast response regardless of total specs in registry
4. **Cost**: Only pays for the versions of that specific spec

### Why search-specs Uses Scan

1. **Don't know partition key**: Searching across all specs
2. **Multiple fields**: Need to search specName, description, and tags
3. **No suitable index**: Would need multiple GSIs for each searchable field
4. **Acceptable for MVP**: With Limit: 100, performance is acceptable for small registry

### Sort Key Behavior

The `ScanIndexForward` parameter controls sort order:

- `ScanIndexForward: true` (default) - Ascending order (oldest first)
- `ScanIndexForward: false` - Descending order (newest first)

For get-spec, we use `false` to return newest versions first, which is what users typically want.

### Global Secondary Indexes (GSI)

The specs table has two GSIs defined in Terraform:

1. **username-createdAt-index**
   - Partition key: username
   - Sort key: createdAt
   - Use case: Get all specs by a specific user, sorted by date

2. **all-createdAt-index**
   - Partition key: allSpecs (always "ALL")
   - Sort key: createdAt
   - Use case: Get recently published specs across all users

These GSIs could be used for future features like "user profile" or "recently published" pages.

## Challenges & Considerations

**Path Parameter Extraction:**
API Gateway provides path parameters in `event.pathParameters`, but they need validation before use. Zod ensures they're in the correct format.

**Version Sorting:**
DynamoDB sorts strings lexicographically, which works for semver (1.0.0, 1.0.1, 1.1.0) but might not work for all version schemes. For now, we rely on `ScanIndexForward: false` for descending order.

**Empty Results:**
Distinguishing between "spec doesn't exist" and "spec has no versions" - we treat both as 404 since a spec without versions shouldn't exist in the table.

## Next Steps

1. Deploy Lambda via Terraform
2. Test with various username/specName combinations
3. Test error cases (invalid parameters, non-existent specs)
4. Integrate with API Gateway (Task 8)
5. Test end-to-end retrieval flow (Task 9)
