import { z } from 'zod/v4';

/**
 * Schema for GitHub Device Flow initiation request
 * POST https://github.com/login/device/code
 */
export const deviceFlowInitRequestSchema = z.object({
  client_id: z.string(),
  scope: z.string().optional(),
});

/**
 * Schema for GitHub Device Flow initiation response
 * This is what GitHub returns when we initiate device flow
 */
export const deviceFlowInitResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string().url(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive(),
});

/**
 * Schema for our Lambda's response to the CLI
 * We pass through GitHub's response directly
 */
export const authDeviceInitLambdaResponseSchema = deviceFlowInitResponseSchema;

export type DeviceFlowInitResponse = z.infer<typeof deviceFlowInitResponseSchema>;
export type AuthDeviceInitLambdaResponse = z.infer<typeof authDeviceInitLambdaResponseSchema>;
