import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Set API_URL before importing the module (required by api-client.ts)
process.env.API_URL = 'https://test-api.example.com/prod';

import {
  initiateDeviceFlow,
  pollDeviceAuthorization,
  publishSpec,
  searchSpecs,
  getSpec,
  ApiError,
} from './api-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
// @ts-expect-error - Mocking fetch with partial Response objects for testing
global.fetch = mockFetch as typeof fetch;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('initiateDeviceFlow', () => {
    it('should successfully initiate device flow', async () => {
      const mockResponse = {
        device_code: 'test_device_code',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await initiateDeviceFlow();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/device/init'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should throw ApiError on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(initiateDeviceFlow()).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on invalid response schema', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(initiateDeviceFlow()).rejects.toThrow(ApiError);
    });

    it('should retry on network failure', async () => {
      // First two attempts fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            device_code: 'test_device_code',
            user_code: 'ABCD-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 5,
          }),
        });

      const result = await initiateDeviceFlow();

      expect(result.device_code).toBe('test_device_code');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(initiateDeviceFlow()).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('pollDeviceAuthorization', () => {
    it('should return success response (200)', async () => {
      const mockResponse = {
        token: 'gho_test_token',
        username: 'testuser',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await pollDeviceAuthorization('test_device_code');

      expect(result.status).toBe(200);
      expect(result.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/device/poll'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ device_code: 'test_device_code' }),
        }),
      );
    });

    it('should return pending response (202)', async () => {
      const mockResponse = {
        status: 'authorization_pending',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 202,
        json: async () => mockResponse,
      });

      const result = await pollDeviceAuthorization('test_device_code');

      expect(result.status).toBe(202);
      expect(result.data).toEqual(mockResponse);
    });

    it('should return error response (400)', async () => {
      const mockResponse = {
        error: 'expired_token',
        message: 'The device code has expired',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse,
      });

      const result = await pollDeviceAuthorization('test_device_code');

      expect(result.status).toBe(400);
      expect(result.data).toEqual(mockResponse);
    });

    it('should throw ApiError on invalid success response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(pollDeviceAuthorization('test_device_code')).rejects.toThrow(ApiError);
    });
  });

  describe('publishSpec', () => {
    const mockToken = 'gho_test_token';
    const mockManifest = {
      name: 'test-spec',
      version: '1.0.0',
      description: 'Test spec',
    };
    const mockFiles = {
      'README.md': '# Test',
      'spec.md': '## Spec',
    };

    it('should successfully publish a spec', async () => {
      const mockResponse = {
        message: 'Successfully published test-spec@1.0.0',
        url: 'https://registry.spectrl.dev/testuser/test-spec',
        specId: 'testuser/test-spec',
        version: '1.0.0',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await publishSpec(mockToken, mockManifest, mockFiles);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/publish'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          }),
          body: expect.stringContaining('test-spec'),
        }),
      );
    });

    it('should throw ApiError on authentication failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(publishSpec(mockToken, mockManifest, mockFiles)).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on invalid response schema', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(publishSpec(mockToken, mockManifest, mockFiles)).rejects.toThrow(ApiError);
    });

    it('should retry on server error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Successfully published test-spec@1.0.0',
            url: 'https://registry.spectrl.dev/testuser/test-spec',
            specId: 'testuser/test-spec',
            version: '1.0.0',
          }),
        });

      const result = await publishSpec(mockToken, mockManifest, mockFiles);

      expect(result.specId).toBe('testuser/test-spec');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchSpecs', () => {
    it('should successfully search for specs', async () => {
      const mockResponse = {
        results: [
          {
            specId: 'alice/api-spec',
            description: 'REST API specification template',
            tags: ['api', 'rest'],
            version: '2.1.0',
            publishedAt: '2024-12-08T10:00:00Z',
          },
          {
            specId: 'bob/graphql-api',
            description: 'GraphQL API design patterns',
            tags: ['api', 'graphql'],
            version: '1.5.2',
            publishedAt: '2024-11-15T10:00:00Z',
          },
        ],
        count: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await searchSpecs('api');

      expect(result).toEqual(mockResponse);
      expect(result.results).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?q=api'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        results: [],
        count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await searchSpecs('nonexistent');

      expect(result.results).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should properly encode search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [], count: 0 }),
      });

      await searchSpecs('test query with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test%20query%20with%20spaces'),
        expect.any(Object),
      );
    });

    it('should throw ApiError on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(searchSpecs('api')).rejects.toThrow(ApiError);
    });
  });

  describe('getSpec', () => {
    it('should successfully get spec metadata', async () => {
      const mockResponse = {
        specId: 'alice/api-spec',
        username: 'alice',
        specName: 'api-spec',
        versions: [
          {
            version: '2.1.0',
            description: 'REST API specification template',
            tags: ['api', 'rest'],
            publishedAt: '2024-12-08T10:00:00Z',
            s3Path: 'specs/alice/api-spec/2.1.0',
            hash: 'abc123',
            downloads: 145,
          },
          {
            version: '2.0.0',
            description: 'REST API specification template',
            tags: ['api', 'rest'],
            publishedAt: '2024-11-15T10:00:00Z',
            s3Path: 'specs/alice/api-spec/2.0.0',
            hash: 'def456',
            downloads: 89,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await getSpec('alice', 'api-spec');

      expect(result).toEqual(mockResponse);
      expect(result.versions).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/specs/alice/api-spec'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should throw ApiError on spec not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Spec not found',
      });

      await expect(getSpec('alice', 'nonexistent')).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on invalid response schema', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(getSpec('alice', 'api-spec')).rejects.toThrow(ApiError);
    });

    it('should retry on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          specId: 'alice/api-spec',
          username: 'alice',
          specName: 'api-spec',
          versions: [
            {
              version: '2.1.0',
              publishedAt: '2024-12-08T10:00:00Z',
              s3Path: 'specs/alice/api-spec/2.1.0',
              hash: 'abc123',
            },
          ],
        }),
      });

      const result = await getSpec('alice', 'api-spec');

      expect(result.specId).toBe('alice/api-spec');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('should create ApiError with status code and response', () => {
      const error = new ApiError('Test error', 404, { detail: 'Not found' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.response).toEqual({ detail: 'Not found' });
      expect(error.name).toBe('ApiError');
    });

    it('should handle retry exhaustion', async () => {
      // All attempts fail
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(initiateDeviceFlow()).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
