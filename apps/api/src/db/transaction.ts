import type { Pool, PoolClient } from 'pg';

export type Tx = PoolClient;

export interface Db {
  query: Pool['query'];
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

export function createDb(pool: Pool): Db {
  return {
    query: pool.query.bind(pool) as Pool['query'],
    async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the original transaction error.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
