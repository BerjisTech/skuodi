import { z } from 'zod';

const booleanString = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    value === true || value === 'true' || value === '1' ? true : false
  );

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().min(0).max(65535).default(3001),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres connection string"),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
  LIVEKIT_WS_URL: z.string().min(1, 'LIVEKIT_WS_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PAYMENTS_ENABLED: booleanString.default(false),
  YJS_WS_URL: z.string().default('ws://yws:1234'),
  FRONTEND_ORIGIN: z.string().optional(),
});

export type EnvVars = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return parsed.data;
}
