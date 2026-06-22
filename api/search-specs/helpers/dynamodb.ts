import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ScanCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { searchResultSchema, type SearchResult } from '../schemas/response';

const defaultAWSRegion = 'eu-north-1';

// Schema for validating DynamoDB ExclusiveStartKey structure
const exclusiveStartKeySchema = z.record(z.unknown());

/**
 * Decode base64 nextToken to DynamoDB ExclusiveStartKey
 * @throws Error if token is invalid or corrupted
 */
function decodeNextToken(nextToken: string): Record<string, unknown> | undefined {
  if (!nextToken || nextToken.trim() === '') {
    return undefined;
  }

  try {
    // Decode base64 to JSON string
    const decoded = Buffer.from(nextToken, 'base64').toString('utf-8');

    // Parse JSON
    const parsed = JSON.parse(decoded);

    // Validate structure
    const result = exclusiveStartKeySchema.safeParse(parsed);

    if (!result.success) {
      throw new Error('Invalid token structure');
    }

    return result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invalid nextToken: ${message}`);
  }
}

/**
 * Encode DynamoDB LastEvaluatedKey to base64 nextToken
 */
function encodeNextToken(
  lastEvaluatedKey: Record<string, unknown> | undefined,
): string | undefined {
  if (!lastEvaluatedKey) {
    return undefined;
  }

  try {
    const json = JSON.stringify(lastEvaluatedKey);
    return Buffer.from(json, 'utf-8').toString('base64');
  } catch (error) {
    console.error('Error encoding nextToken:', error);
    return undefined;
  }
}

export interface SearchSpecsParams {
  query: string;
  limit?: number;
  nextToken?: string;
  type?: 'spec' | 'power';
}

export interface SearchSpecsResult {
  results: SearchResult[];
  count: number;
  nextToken?: string;
  hasMore: boolean;
}

/**
 * Search specs in DynamoDB using Scan with cursor-based pagination
 *
 * Matches query against:
 * - specName (case-insensitive contains)
 * - description (case-insensitive contains)
 * - tags array (case-insensitive contains)
 *
 * Returns paginated results with nextToken for fetching more
 */
export async function searchSpecs(params: SearchSpecsParams): Promise<SearchSpecsResult> {
  const { query, limit = 20, nextToken, type } = params;

  console.log('Searching specs in DynamoDB...');

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
  });
  const docClient = DynamoDBDocumentClient.from(client);

  // Decode nextToken to ExclusiveStartKey
  const exclusiveStartKey = nextToken ? decodeNextToken(nextToken) : undefined;

  // Scan DynamoDB with pagination
  // Note: We scan exactly 'limit' items for true cursor-based pagination
  // This means we might return fewer than 'limit' results after deduplication
  // if there are multiple versions of the same spec in the scanned batch
  const scanLimit = limit;

  // For 'spec' type: match items where type = 'spec' OR type attribute is absent
  // (legacy items were published before the type field existed and default to 'spec')
  // For 'power' type: strict match only
  const typeFilter =
    type === 'spec'
      ? {
          FilterExpression: '#itemType = :typeVal OR attribute_not_exists(#itemType)',
          ExpressionAttributeNames: { '#itemType': 'type' },
          ExpressionAttributeValues: { ':typeVal': type },
        }
      : type === 'power'
        ? {
            FilterExpression: '#itemType = :typeVal',
            ExpressionAttributeNames: { '#itemType': 'type' },
            ExpressionAttributeValues: { ':typeVal': type },
          }
        : {};

  const command = new ScanCommand({
    TableName: process.env.SPECS_TABLE,
    Limit: scanLimit,
    ExclusiveStartKey: exclusiveStartKey,
    ...typeFilter,
  });

  const response = await docClient.send(command);
  const items = response.Items || [];

  console.log(
    `Scanned ${items.length} items, LastEvaluatedKey: ${response.LastEvaluatedKey ? 'present' : 'none'}`,
  );

  // Filter by query (type is already filtered at DB level via FilterExpression when set,
  // but we also filter in-memory as a safety net for cases where the DB filter isn't applied)
  const queryLower = query?.toLowerCase() || '';
  const filtered =
    queryLower || type
      ? items.filter((item) => {
          const specName = ((item.specName as string) || '').toLowerCase();
          const description = ((item.description as string) || '').toLowerCase();
          const tags = ((item.tags as string[]) || []).map((t) => t.toLowerCase());

          const matchesQuery =
            !queryLower ||
            specName.includes(queryLower) ||
            description.includes(queryLower) ||
            tags.some((tag) => tag.includes(queryLower));

          const itemType = (item.type as string) || 'spec';
          const matchesType = !type || itemType === type;

          return matchesQuery && matchesType;
        })
      : items;

  // Sort by createdAt descending (newest first)
  const sorted = filtered.sort((a, b) => {
    const dateA = new Date(a.createdAt as string).getTime();
    const dateB = new Date(b.createdAt as string).getTime();
    return dateB - dateA;
  });

  // Deduplicate by specId - keep only the latest version of each spec
  const deduped = deduplicateBySpecId(sorted);

  // Check if we need to fetch more pages to fill the limit
  if (deduped.length < limit && response.LastEvaluatedKey) {
    console.log(`Only found ${deduped.length} unique specs, fetching more...`);

    // Recursively fetch more pages
    const nextPageToken = encodeNextToken(response.LastEvaluatedKey);
    const nextPage = await searchSpecs({
      query,
      limit: limit - deduped.length,
      nextToken: nextPageToken,
      type,
    });

    // Merge results and deduplicate again (in case of overlap)
    const merged = [...deduped, ...nextPage.results.map(reverseMapSearchResult)];
    const finalDeduped = deduplicateBySpecId(merged);
    const finalResults = finalDeduped.slice(0, limit).map(mapToSearchResult);

    return {
      results: finalResults,
      count: finalResults.length,
      nextToken: nextPage.nextToken,
      hasMore: nextPage.hasMore,
    };
  }

  // Take only requested limit
  const results = deduped.slice(0, limit);

  // Determine if there are more results
  // We have more if:
  // 1. DynamoDB has more items (LastEvaluatedKey exists), OR
  // 2. We have more deduped items than the limit
  const hasMore = !!response.LastEvaluatedKey || deduped.length > limit;

  // Encode LastEvaluatedKey as nextToken for next page
  const responseNextToken = response.LastEvaluatedKey
    ? encodeNextToken(response.LastEvaluatedKey)
    : undefined;

  console.log(
    `Returning ${results.length} unique specs, hasMore: ${hasMore}, dedupedTotal: ${deduped.length}, hasLastEvaluatedKey: ${!!response.LastEvaluatedKey}`,
  );

  return {
    results: results.map(mapToSearchResult),
    count: results.length,
    nextToken: responseNextToken,
    hasMore,
  };
}

/**
 * Deduplicate items by specId, keeping only the first occurrence (latest version)
 * Assumes items are already sorted by createdAt descending
 */
function deduplicateBySpecId(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];

  for (const item of items) {
    const specId = item.specId as string;
    if (!seen.has(specId)) {
      seen.add(specId);
      result.push(item);
    }
  }

  return result;
}

/**
 * Map DynamoDB item to SearchResult with validation
 */
function mapToSearchResult(item: Record<string, unknown>): SearchResult {
  const result = searchResultSchema.parse({
    specId: item.specId,
    version: item.version,
    username: item.username,
    specName: item.specName,
    description: item.description,
    type: item.type || 'spec',
    tags: item.tags || [],
    publishedAt: item.createdAt, // Rename field for CLI consistency
  });

  return result;
}

/**
 * Reverse map SearchResult back to DynamoDB item format
 * Used for deduplication after merging paginated results
 */
function reverseMapSearchResult(result: SearchResult): Record<string, unknown> {
  return {
    specId: result.specId,
    version: result.version,
    username: result.username,
    specName: result.specName,
    description: result.description,
    type: result.type,
    tags: result.tags,
    createdAt: result.publishedAt, // Reverse the field name transformation
  };
}
