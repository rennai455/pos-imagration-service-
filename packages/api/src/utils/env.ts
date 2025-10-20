// Load environment variables in development only
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch {
    // dotenv not available in production, that's fine
  }
}

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1), // Railway uses sslmode=disable, not a valid URL
  WEBHOOK_SECRET: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().min(1), // CSV format
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'), // Railway requires 0.0.0.0
  PORT: z.coerce.number().positive().default(4000),
  REQUEST_TIMEOUT_MS: z.coerce.number().positive().default(30000),
  CONNECTION_TIMEOUT_MS: z.coerce.number().positive().default(60000),
  SHUTDOWN_GRACE_MS: z.coerce.number().positive().default(15000),
  // Optional Supabase (not required for Railway deployment)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(err => `- ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      
      throw new Error(
        `Missing or invalid environment variables:\n${missingVars}\n\n` +
        `Please check your .env file and make sure all required variables are set correctly.`
      );
    }
    throw error;
  }
}