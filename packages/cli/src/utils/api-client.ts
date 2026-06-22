import { z } from 'zod';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables from .env file for local development
// Skip in test environment to avoid noisy output
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  config({ path: join(__dirname, '../../.env'), override: false, quiet: true });
}

/**
 * API client for Spectrl public registry
 *
 * Provides typed functions for all registry API endpoints with:
 * - Request/response validation using Zod
 * - Automatic retry logic for network failures
 * - Configurable API URL via environment variable or .env file
 */

/**
 * Get the API URL from environment variable or build-time default
 *
 * Priority:
 * 1. API_URL environment variable (if set at runtime)
 * 2. API_URL from .env file (if exists)
 * 3. DEFAULT_API_URL (injected at build time)
 *
 * @throws {Error} If no API URL is configured
 * @returns The API URL
 */
export function getApiUrl(): string {
  // Check runtime environment variable or .env file
  const runtimeApiUrl = process.env.API_URL;
  if (runtimeApiUrl) {
    return runtimeApiUrl;
  }

  // Fall back to build-time default (injected via esbuild define)
  const defaultApiUrl = process.env.DEFAULT_API_URL;
  if (defaultApiUrl) {
    return defaultApiUrl;
  }

  // No API URL configured (should never happen in production builds)
  throw new Error(
    'Registry API URL is not configured. ' + 'Please contact support or reinstall the CLI.',
  );
}

// ============================================================================
// Zod Schemas for API Responses
// ============================================================================

/**
 * Schema for device flow initialization response
 */
export const DeviceFlowInitResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number(),
  interval: z.number(),
});

export type DeviceFlowInitResponse = z.infer<typeof DeviceFlowInitResponseSchema>;

/**
 * Schema for successful device flow poll response
 */
export const DeviceFlowPollSuccessSchema = z.object({
  token: z.string(),
  username: z.string(),
});

export type DeviceFlowPollSuccess = z.infer<typeof DeviceFlowPollSuccessSchema>;

/**
 * Schema for pending/error device flow poll response
 */
export const DeviceFlowPollPendingSchema = z.object({
  status: z.string(),
});

export const DeviceFlowPollErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export type DeviceFlowPollPending = z.infer<typeof DeviceFlowPollPendingSchema>;
export type DeviceFlowPollError = z.infer<typeof DeviceFlowPollErrorSchema>;

/**
 * Schema for publish spec request
 */
export const PublishSpecRequestSchema = z.object({
  manifest: z.record(z.string(), z.unknown()),
  files: z.record(z.string(), z.string()), // Record mapping filename -> content
});

export type PublishSpecRequest = z.infer<typeof PublishSpecRequestSchema>;

/**
 * Schema for publish spec response
 */
export const PublishSpecResponseSchema = z.object({
  message: z.string(),
  url: z.string(),
  specId: z.string(),
  version: z.string(),
});

export type PublishSpecResponse = z.infer<typeof PublishSpecResponseSchema>;

/**
 * Schema for search results
 */
export const SearchResultSchema = z.object({
  specId: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.string(),
  publishedAt: z.string(),
});

export const SearchSpecsResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  count: z.number(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchSpecsResponse = z.infer<typeof SearchSpecsResponseSchema>;

/**
 * Schema for spec version metadata
 */
export const SpecVersionSchema = z.object({
  version: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  publishedAt: z.string(),
  s3Path: z.string(),
  hash: z.string(),
  downloads: z.number().optional(),
});

export const GetSpecResponseSchema = z.object({
  specId: z.string(),
  username: z.string(),
  specName: z.string(),
  versions: z.array(SpecVersionSchema),
});

export type SpecVersion = z.infer<typeof SpecVersionSchema>;
export type GetSpecResponse = z.infer<typeof GetSpecResponseSchema>;

/**
 * Schema for unpublish spec response
 */
export const UnpublishSpecResponseSchema = z.object({
  message: z.string(),
});

export type UnpublishSpecResponse = z.infer<typeof UnpublishSpecResponseSchema>;

/**
 * Schema for track download request
 */
export const TrackDownloadRequestSchema = z.object({
  username: z.string(),
  specName: z.string(),
  version: z.string(),
});

export type TrackDownloadRequest = z.infer<typeof TrackDownloadRequestSchema>;

/**
 * Schema for track download response
 */
export const TrackDownloadResponseSchema = z.object({
  success: z.literal(true),
  downloads: z.number(),
});

export type TrackDownloadResponse = z.infer<typeof TrackDownloadResponseSchema>;

// ============================================================================
// Error Types
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// Retry Logic Helper
// ============================================================================

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (4xx) or validation errors
      if (error instanceof ApiError && error.statusCode && error.statusCode < 500) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError || new Error('Retry failed');
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Initiate GitHub Device Flow authentication
 *
 * @returns Device code, user code, verification URI, and polling parameters
 * @throws {ApiError} If the request fails or response is invalid
 */
export async function initiateDeviceFlow(): Promise<DeviceFlowInitResponse> {
  return withRetry(async () => {
    const response = await fetch(`${getApiUrl()}/auth/device/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `Failed to initiate device flow: ${errorText}`,
        response.status,
        errorText,
      );
    }

    const data = await response.json();
    const parseResult = DeviceFlowInitResponseSchema.safeParse(data);

    if (!parseResult.success) {
      throw new ApiError(
        'Invalid API response format during device flow initialization.',
        response.status,
        data,
      );
    }

    return parseResult.data;
  });
}

/**
 * Poll for device authorization completion
 *
 * @param deviceCode - The device code from initiateDeviceFlow
 * @returns Object with status and data (token/username on success, status on pending, error on failure)
 * @throws {ApiError} If the request fails or response is invalid
 */
export async function pollDeviceAuthorization(deviceCode: string): Promise<{
  status: number;
  data: DeviceFlowPollSuccess | DeviceFlowPollPending | DeviceFlowPollError;
}> {
  // Don't retry polling - it's meant to be called repeatedly by the caller
  const response = await fetch(`${getApiUrl()}/auth/device/poll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_code: deviceCode }),
  });

  const data = await response.json();

  // Handle different response statuses
  if (response.status === 200) {
    const parseResult = DeviceFlowPollSuccessSchema.safeParse(data);
    if (!parseResult.success) {
      throw new ApiError(
        `Invalid success response: ${parseResult.error.message}`,
        response.status,
        data,
      );
    }
    return { status: 200, data: parseResult.data };
  }

  if (response.status === 202) {
    const parseResult = DeviceFlowPollPendingSchema.safeParse(data);
    if (!parseResult.success) {
      throw new ApiError(
        `Invalid pending response: ${parseResult.error.message}`,
        response.status,
        data,
      );
    }
    return { status: 202, data: parseResult.data };
  }

  // 400 or other error
  const parseResult = DeviceFlowPollErrorSchema.safeParse(data);
  if (!parseResult.success) {
    throw new ApiError(
      `Invalid error response: ${parseResult.error.message}`,
      response.status,
      data,
    );
  }
  return { status: response.status, data: parseResult.data };
}

/**
 * Publish a spec to the public registry
 *
 * @param token - GitHub access token
 * @param manifest - Spec manifest object
 * @param files - Record mapping file paths to their content
 * @returns Publish response with message, URL, specId, and version
 * @throws {ApiError} If the request fails or response is invalid
 */
export async function publishSpec(
  token: string,
  manifest: Record<string, unknown>,
  files: Record<string, string>,
): Promise<PublishSpecResponse> {
  return withRetry(async () => {
    // Validate request data
    const requestData: PublishSpecRequest = { manifest, files };
    const requestValidation = PublishSpecRequestSchema.safeParse(requestData);

    if (!requestValidation.success) {
      throw new ApiError(
        `Invalid request data: ${requestValidation.error.message}`,
        undefined,
        requestData,
      );
    }

    const response = await fetch(`${getApiUrl()}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestValidation.data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`Failed to publish spec: ${errorText}`, response.status, errorText);
    }

    const data = await response.json();
    const parseResult = PublishSpecResponseSchema.safeParse(data);

    if (!parseResult.success) {
      throw new ApiError('Invalid API response format after publishing.', response.status, data);
    }

    return parseResult.data;
  });
}

/**
 * Search for specs in the public registry
 *
 * @param query - Search query string
 * @returns Search results with array of specs and total count
 * @throws {ApiError} If the request fails or response is invalid
 */
export async function searchSpecs(query: string): Promise<SearchSpecsResponse> {
  return withRetry(async () => {
    const response = await fetch(`${getApiUrl()}/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`Failed to search specs: ${errorText}`, response.status, errorText);
    }

    const data = await response.json();
    const parseResult = SearchSpecsResponseSchema.safeParse(data);

    if (!parseResult.success) {
      // Provide a more user-friendly error message
      throw new ApiError(
        'Invalid API response format. Expected search results but received unexpected data.',
        response.status,
        data,
      );
    }

    return parseResult.data;
  });
}

/**
 * Get spec metadata including all versions
 *
 * @param username - Spec owner's username
 * @param name - Spec name
 * @returns Spec metadata with all versions
 * @throws {ApiError} If the request fails or response is invalid
 */
export async function getSpec(username: string, name: string): Promise<GetSpecResponse> {
  return withRetry(async () => {
    const response = await fetch(`${getApiUrl()}/specs/${username}/${name}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`Failed to get spec: ${errorText}`, response.status, errorText);
    }

    const data = await response.json();
    const parseResult = GetSpecResponseSchema.safeParse(data);

    if (!parseResult.success) {
      throw new ApiError(
        'Invalid API response format when fetching spec metadata.',
        response.status,
        data,
      );
    }

    return parseResult.data;
  });
}

/**
 * Unpublish a spec version from the public registry
 *
 * @param token - GitHub access token
 * @param username - Spec owner's username
 * @param name - Spec name
 * @param version - Spec version to unpublish
 * @returns Unpublish response with confirmation message
 * @throws {ApiError} If the request fails or response is invalid
 */
export async function unpublishSpec(
  token: string,
  username: string,
  name: string,
  version: string,
): Promise<UnpublishSpecResponse> {
  return withRetry(async () => {
    const response = await fetch(`${getApiUrl()}/specs/${username}/${name}/${version}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(`Failed to unpublish spec: ${errorText}`, response.status, errorText);
    }

    const data = await response.json();
    const parseResult = UnpublishSpecResponseSchema.safeParse(data);

    if (!parseResult.success) {
      throw new ApiError('Invalid API response format after unpublishing.', response.status, data);
    }

    return parseResult.data;
  });
}

/**
 * Track a spec download (fire-and-forget pattern)
 *
 * This function sends a download tracking request to the API but does not wait for
 * or handle the response. It uses a 3-second timeout and silently fails on errors.
 * This ensures that download tracking never blocks or fails spec installation.
 *
 * No authentication is required. Rate limiting is handled by API Gateway based on IP address.
 *
 * @param username - Spec owner's username
 * @param specName - Spec name
 * @param version - Spec version
 */
export function trackDownload(username: string, specName: string, version: string): void {
  // Validate request data
  const requestData: TrackDownloadRequest = { username, specName, version };
  const requestValidation = TrackDownloadRequestSchema.safeParse(requestData);

  if (!requestValidation.success) {
    // Invalid request data - skip tracking silently
    if (process.env.DEBUG) {
      console.error('[DEBUG] Invalid track download request:', requestValidation.error.message);
    }
    return;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  // Fire-and-forget: send request but don't await response
  fetch(`${getApiUrl()}/track-download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestValidation.data),
    signal: controller.signal,
  })
    .then((response) => {
      clearTimeout(timeoutId);
      // Log only in debug mode
      if (process.env.DEBUG) {
        if (response.ok) {
          console.error('[DEBUG] Download tracked successfully');
        } else {
          console.error('[DEBUG] Download tracking failed:', response.status);
        }
      }
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      // Silent failure - log only in debug mode
      if (process.env.DEBUG) {
        if (error.name === 'AbortError') {
          console.error('[DEBUG] Download tracking timed out');
        } else {
          console.error('[DEBUG] Download tracking error:', error.message);
        }
      }
    });
}
