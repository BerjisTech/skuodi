import { EnvVars } from './env.validation';

export type AppConfig = ReturnType<typeof configuration>;

export const configuration = (env: EnvVars) => ({
  nodeEnv: env.NODE_ENV,
  http: {
    port: env.PORT,
    corsOrigin: env.FRONTEND_ORIGIN ?? '*',
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  s3: {
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    paymentsEnabled: env.PAYMENTS_ENABLED,
  },
  livekit: {
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    wsUrl: env.LIVEKIT_WS_URL,
  },
  collaboration: {
    yjsWsUrl: env.YJS_WS_URL,
  },
});
