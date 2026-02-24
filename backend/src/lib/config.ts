import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max: parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
  },
  reservationTtlMinutes: parseInt(
    optionalEnv('RESERVATION_TTL_MINUTES', '5'),
    10
  ),
  allowedOrigins: optionalEnv(
    'ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim()),
} as const;
