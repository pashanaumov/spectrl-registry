import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { unpublish } from './index.js';
import { TokenManager } from '../../auth/token-manager.js';
import { CLIError, ExitCode } from '../../errors.js';

// Set API_URL before importing
process.env.API_URL = 'https://test-api.example.com/prod';

// Mock inquirer prompts
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}));

// Setup MSW server for mocking HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('unpublish command', () => {
  let tokenManagerGetSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock TokenManager to return a valid token
    tokenManagerGetSpy = vi.spyOn(TokenManager.prototype, 'get').mockResolvedValue('test_token');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    tokenManagerGetSpy.mockRestore();
  });

  describe('validation', () => {
    it('should throw error for invalid spec reference', async () => {
      await expect(unpublish('invalid spec ref')).rejects.toThrow(CLIError);
      await expect(unpublish('invalid spec ref')).rejects.toThrow('Invalid spec reference');
    });

    it('should throw error for local spec reference', async () => {
      await expect(unpublish('my-spec@1.0.0')).rejects.toThrow(CLIError);
      await expect(unpublish('my-spec@1.0.0')).rejects.toThrow(
        'Unpublish only works with public specs',
      );
    });

    it('should throw error when version is not specified', async () => {
      await expect(unpublish('alice/my-spec')).rejects.toThrow(CLIError);
      await expect(unpublish('alice/my-spec')).rejects.toThrow('Version is required');
    });
  });

  describe('authentication', () => {
    it('should throw error when not logged in', async () => {
      // Mock TokenManager to return null (not logged in)
      tokenManagerGetSpy.mockResolvedValue(null);

      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow(CLIError);
      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow('need to login first');
    });

    it('should throw error when token is invalid (401)', async () => {
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(true);

      // Mock API to return 401
      server.use(
        http.delete('https://test-api.example.com/prod/specs/alice/my-spec/1.0.0', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),
      );

      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow(CLIError);
      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow('Authentication failed');
    });

    it('should throw error when user lacks permission (403)', async () => {
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(true);

      // Mock API to return 403
      server.use(
        http.delete('https://test-api.example.com/prod/specs/alice/my-spec/1.0.0', () => {
          return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
        }),
      );

      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow(CLIError);
      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow('Authentication failed');
    });
  });

  describe('confirmation flow', () => {
    it('should cancel when user declines confirmation', async () => {
      // Mock inquirer select to return false (cancel)
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(false);

      // Should not throw, just return
      await unpublish('alice/my-spec@1.0.0');

      // Verify API was not called
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
    });

    it('should proceed when user confirms', async () => {
      // Mock inquirer select to return true (confirm)
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(true);

      // Mock successful API response
      server.use(
        http.delete('https://test-api.example.com/prod/specs/alice/my-spec/1.0.0', () => {
          return HttpResponse.json({
            message: 'Successfully unpublished alice/my-spec@1.0.0',
          });
        }),
      );

      await unpublish('alice/my-spec@1.0.0');

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully unpublished'),
      );
    });
  });

  describe('API errors', () => {
    it('should throw error when spec not found (404)', async () => {
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(true);
      // Mock API to return 404
      server.use(
        http.delete('https://test-api.example.com/prod/specs/alice/my-spec/1.0.0', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow(CLIError);
      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow('not found');
    });

    it('should throw error on server error (500)', { timeout: 10000 }, async () => {
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(true);

      // Mock API to return 500
      server.use(
        http.delete('https://test-api.example.com/prod/specs/alice/my-spec/1.0.0', () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        }),
      );

      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow(CLIError);
      await expect(unpublish('alice/my-spec@1.0.0')).rejects.toThrow('Failed to unpublish');
    });
  });

  describe('successful unpublish', () => {
    it('should successfully unpublish a spec version', async () => {
      // Mock inquirer select to confirm
      const { select } = await import('@inquirer/prompts');
      vi.mocked(select).mockResolvedValue(true);

      // Mock successful API response
      server.use(
        http.delete('https://test-api.example.com/prod/specs/alice/my-spec/1.0.0', () => {
          return HttpResponse.json({
            message: 'Successfully unpublished alice/my-spec@1.0.0',
          });
        }),
      );

      await unpublish('alice/my-spec@1.0.0');

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully unpublished'),
      );
    });
  });
});
