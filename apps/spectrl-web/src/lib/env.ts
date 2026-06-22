import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    // Server-side environment variables
    NODE_ENV: z.enum(['development', 'test', 'production']),
  },
  client: {
    // Client-side environment variables (must be prefixed with NEXT_PUBLIC_)
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_CDN_URL: z.string().url(),
  },
  // For Next.js >= 13.4.4, you only need to destructure client variables:
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  },
});
