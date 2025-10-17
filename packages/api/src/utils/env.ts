import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().positive().default(3000),
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