import { env } from './env';
import {
  SearchResponseSchema,
  GetSpecResponseSchema,
  ApiErrorResponseSchema,
  ApiError,
  NetworkError,
  type SearchResponse,
  type GetSpecResponse,
} from './schemas';

/**
 * API Client for Spectrl backend
 *
 * Provides server-side API integration with proper Zod validation.
 * All external data is validated before use - never trust API responses!
 *
 * Environment variables are managed via @t3-oss/env-nextjs in ./env.ts
 */

/**
 * Handle fetch errors and API error responses
 */
async function handleApiResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      const parseResult = ApiErrorResponseSchema.safeParse(errorData);

      if (parseResult.success) {
        errorMessage = parseResult.data.error;
      }
    } catch {
      // If we can't parse the error response, use the default message
    }

    throw new ApiError(errorMessage, response.status);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new NetworkError(
      'Failed to parse JSON response',
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Search for specs in the public registry
 *
 * @param query - Optional search query. If empty, returns all specs
 * @param options - Optional pagination options
 * @param options.nextToken - Cursor for next page (from previous response)
 * @param options.limit - Results per page (default: 20, max: 100)
 * @returns Promise<SearchResponse> - Validated search results with pagination metadata
 */
export async function searchSpecs(
  query?: string,
  options?: { nextToken?: string; limit?: number; type?: string },
): Promise<SearchResponse> {
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}/search`);

  if (query?.trim()) {
    url.searchParams.set('q', query.trim());
  }

  if (options?.limit) {
    url.searchParams.set('limit', options.limit.toString());
  }

  if (options?.nextToken) {
    url.searchParams.set('nextToken', options.nextToken);
  }

  if (options?.type) {
    url.searchParams.set('type', options.type);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'spectrl-web-client/1.0.0',
      },
      // Ensure we don't cache search results too aggressively
      next: { revalidate: 60 },
    });
    const data = await handleApiResponse(response);

    // CRITICAL: Validate API response with Zod
    const parseResult = SearchResponseSchema.safeParse(data);

    if (!parseResult.success) {
      console.error('Search API validation failed:', parseResult.error.format());
      throw new ApiError(
        `Invalid search API response: ${parseResult.error.issues[0].message}`,
        response.status,
        data,
      );
    }

    return parseResult.data;
  } catch (error) {
    if (error instanceof ApiError || error instanceof NetworkError) {
      throw error;
    }

    throw new NetworkError(
      `Failed to search specs: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Get metadata for a specific spec
 *
 * @param username - GitHub username
 * @param specName - Spec name
 * @returns Promise<GetSpecResponse> - Validated spec metadata with all versions
 */
export async function getSpec(username: string, specName: string): Promise<GetSpecResponse> {
  if (!username || !specName) {
    throw new Error('Username and spec name are required');
  }

  const url = `${env.NEXT_PUBLIC_API_URL}/specs/${encodeURIComponent(username)}/${encodeURIComponent(specName)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'spectrl-web-client/1.0.0',
      },
      // Revalidate spec metadata reasonably often
      next: { revalidate: 60 },
    });
    const data = await handleApiResponse(response);

    // CRITICAL: Validate API response with Zod
    const parseResult = GetSpecResponseSchema.safeParse(data);

    if (!parseResult.success) {
      console.error('Get spec API validation failed:', parseResult.error.format());
      throw new ApiError(
        `Invalid get spec API response: ${parseResult.error.issues[0].message}`,
        response.status,
        data,
      );
    }

    return parseResult.data;
  } catch (error) {
    if (error instanceof ApiError || error instanceof NetworkError) {
      throw error;
    }

    throw new NetworkError(
      `Failed to get spec ${username}/${specName}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Fetch README content from S3/CloudFront
 *
 * @param s3Path - S3 path to the spec version
 * @returns Promise<string> - Raw README markdown content
 */
export async function getReadme(s3Path: string): Promise<string> {
  return getSpecFile(s3Path, 'README.md');
}

/**
 * Fetch any file content from S3/CloudFront
 *
 * @param s3Path - S3 path to the spec version
 * @param filename - Name of the file to fetch
 * @returns Promise<string> - Raw file content
 */
export async function getSpecFile(s3Path: string, filename: string): Promise<string> {
  if (!s3Path) {
    throw new Error('S3 path is required');
  }

  if (!filename) {
    throw new Error('Filename is required');
  }

  const url = `${env.NEXT_PUBLIC_CDN_URL}/${s3Path}/files/${filename}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'spectrl-web-client/1.0.0',
      },
      // Cache files for a long time since they are versioned/immutable
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new ApiError(
        `Failed to fetch ${filename}: HTTP ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    // File is plain text, no validation needed
    return await response.text();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new NetworkError(
      `Failed to fetch ${filename} from ${s3Path}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Utility function to check if an error is a 404 (not found)
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}

/**
 * Utility function to check if an error is a network/connectivity issue
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof NetworkError;
}
