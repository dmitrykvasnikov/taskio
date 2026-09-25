import { createApp } from '../../apps/api/src/app';
import { createDb } from '../../apps/api/src/db/transaction';
import { createPool } from '../../apps/api/src/db/pool';
import { FixedClock } from './clock';

export async function createTestApp(databaseUrl: string) {
  const pool = createPool(databaseUrl);
  const app = await createApp({
    db: createDb(pool),
    config: { databaseUrl, origin: 'http://localhost:9090', port: 3000, mode: 'development' },
    clock: new FixedClock(new Date('2026-09-25T12:00:00.000Z')),
  });
  app.addHook('onClose', async () => pool.end());
  return app;
}
