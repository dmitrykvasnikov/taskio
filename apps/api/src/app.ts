import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Config } from './config';

export interface Clock {
  now(): Date;
}

export interface AppDependencies {
  db: Pick<Pool, 'query'>;
  config: Config;
  clock: Clock;
}

export async function createApp({ db }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] } });

  app.get('/api/v1/health', async (_request, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok', database: 'ready' };
    } catch {
      reply.code(503);
      return { status: 'unavailable' };
    }
  });

  return app;
}
