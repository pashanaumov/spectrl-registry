import { z } from 'zod/v4';

/**
 * Schema for auth-device-poll Lambda request body
 * The CLI sends the device_code received from the init endpoint
 */
export const devicePollRequestSchema = z.object({
  device_code: z.string(),
});

/**
 * Schema for GitHub Device Flow token request
 * POST https://github.com/login/oauth/access_token
 */
export const deviceFlowTokenRequestSchema = z.object({
  client_id: z.string(),
  device_code: z.string(),
  grant_type: z.literal('urn:ietf:params:oauth:grant-type:device_code'),
});

/**
 * Schema for GitHub Device Flow token response - Success case
 * When the user has authorized the device
 */
export const deviceFlowTokenSuccessResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  scope: z.string(),
});

/**
 * Schema for GitHub Device Flow token response - Error cases
 * When authorization is pending, expired, or denied
 */
export const deviceFlowTokenErrorResponseSchema = z.object({
  error: z.enum([
    'authorization_pending',
    'slow_down',
    'expired_token',
    'access_denied',
    'unsupported_grant_type',
    'incorrect_client_credentials',
    'incorrect_device_code',
  ]),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});

/**
 * Union type for GitHub's response - either success or error
 */
export const deviceFlowTokenResponseSchema = z.union([
  deviceFlowTokenSuccessResponseSchema,
  deviceFlowTokenErrorResponseSchema,
]);

/**
 * Schema for Lambda response - Authorization pending (202)
 */
export const authDevicePollPendingResponseSchema = z.object({
  status: z.literal('authorization_pending'),
});

/**
 * Schema for Lambda response - Success (200)
 */
export const authDevicePollSuccessResponseSchema = z.object({
  token: z.string(),
  username: z.string(),
});

/**
 * Schema for Lambda response - Error (400)
 */
export const authDevicePollErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

// Type exports
export type DevicePollRequest = z.infer<typeof devicePollRequestSchema>;
export type DeviceFlowTokenRequest = z.infer<typeof deviceFlowTokenRequestSchema>;
export type DeviceFlowTokenSuccessResponse = z.infer<typeof deviceFlowTokenSuccessResponseSchema>;
export type DeviceFlowTokenErrorResponse = z.infer<typeof deviceFlowTokenErrorResponseSchema>;
export type AuthDevicePollPendingResponse = z.infer<typeof authDevicePollPendingResponseSchema>;
export type AuthDevicePollSuccessResponse = z.infer<typeof authDevicePollSuccessResponseSchema>;
export type AuthDevicePollErrorResponse = z.infer<typeof authDevicePollErrorResponseSchema>;
