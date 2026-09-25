import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export interface TestDatabase {
  adminUrl: string;
  migratorUrl: string;
  appUrl: string;
  name: string;
  close(): Promise<void>;
}

export function assertTestDatabaseUrl(databaseUrl: string): void {
  const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!/^taskio_test(?:_|$)/.test(database)) {
    throw new Error(`Refusing to use database ${database || '<empty>'}: test databases must start with taskio_test`);
  }
}

function withDatabase(databaseUrl: string, database: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const adminBase = process.env.TEST_ADMIN_DATABASE_URL;
  const migratorBase = process.env.TEST_MIGRATION_DATABASE_URL;
  const appBase = process.env.TEST_DATABASE_URL;
  if (!adminBase || !migratorBase || !appBase) throw new Error('Test database URLs are required');
  [adminBase, migratorBase, appBase].forEach(assertTestDatabaseUrl);

  const name = `taskio_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: adminBase, max: 1 });
  try {
    await admin.query(`CREATE DATABASE ${name} OWNER taskio_migrator`);
  } finally {
    await admin.end();
  }

  const provision = new Pool({ connectionString: withDatabase(adminBase, name), max: 1 });
  let provisionError: unknown;
  try {
    await provision.query(`
      ALTER SCHEMA public OWNER TO taskio_migrator;
      GRANT CONNECT ON DATABASE ${name} TO taskio_app;
      GRANT USAGE ON SCHEMA public TO taskio_app;
      ALTER DEFAULT PRIVILEGES FOR ROLE taskio_migrator IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taskio_app;
      ALTER DEFAULT PRIVILEGES FOR ROLE taskio_migrator IN SCHEMA public
        GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO taskio_app
    `);
  } catch (error) {
    provisionError = error;
  } finally {
    await provision.end();
  }
  if (provisionError) {
    const cleanup = new Pool({ connectionString: adminBase, max: 1 });
    try {
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    } finally {
      await cleanup.end();
    }
    throw provisionError;
  }

  return {
    name,
    adminUrl: withDatabase(adminBase, name),
    migratorUrl: withDatabase(migratorBase, name),
    appUrl: withDatabase(appBase, name),
    async close() {
      const cleanup = new Pool({ connectionString: adminBase, max: 1 });
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
