import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Config } from './config';
import type { Db } from './db/transaction';
import { ApiException, registerErrorHandlers } from './shared/errors';

export interface Clock {
  now(): Date;
}

export interface AppDependencies {
  db: Db;
  config: Config;
  clock: Clock;
  logger?: FastifyServerOptions['logger'];
}

export async function createApp({ db, logger }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 64 * 1024,
    logger: logger ?? {
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.x-csrf-token',
        'res.headers.set-cookie',
        'password',
        '*.password',
        'body',
        '*.body',
      ],
    },
  });
  registerErrorHandlers(app);
  app.addHook('onRequest', async request => {
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return;
    const contentType = request.headers['content-type'];
    if (contentType && !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      throw new ApiException(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    }
  });

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
