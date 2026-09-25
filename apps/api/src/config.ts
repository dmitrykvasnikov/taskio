export interface Config {
  databaseUrl: string;
  origin: string;
  port: number;
  mode: 'development' | 'production';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = env.NODE_ENV ?? 'development';
  if (mode !== 'development' && mode !== 'production') {
    throw new Error('NODE_ENV must be development or production');
  }
  const origin = env.APP_ORIGIN;
  if (!origin) throw new Error('APP_ORIGIN is required');
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error('APP_ORIGIN must be an absolute origin');
  }
  if (parsedOrigin.origin !== origin || !['http:', 'https:'].includes(parsedOrigin.protocol)) {
    throw new Error('APP_ORIGIN must be an HTTP(S) origin without a path');
  }
  if (mode === 'production' && parsedOrigin.protocol !== 'https:') {
    throw new Error('Production authentication requires an HTTPS public origin');
  }
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  try {
    const parsedDatabase = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsedDatabase.protocol) || !parsedDatabase.hostname) {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  const port = Number(env.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be a valid port');
  }
  return { databaseUrl, origin, port, mode };
}
