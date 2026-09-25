import { createApp } from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { createDb } from './db/transaction';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createPool(config.databaseUrl);
  db.on('error', () => {
    console.error('An idle database connection was lost');
  });
  const app = await createApp({ db: createDb(db), config, clock: { now: () => new Date() } });
  let closing = false;

  async function close(): Promise<void> {
    if (closing) return;
    closing = true;
    await app.close();
    await db.end();
  }
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });

  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await db.query('SELECT 1');
        break;
      } catch {
        if (attempt >= 29) throw new Error('Database was not ready after 30 attempts');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    await app.listen({ host: '0.0.0.0', port: config.port });
  } catch (error) {
    await close();
    throw error;
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
