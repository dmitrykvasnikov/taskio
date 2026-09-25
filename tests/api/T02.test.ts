import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Type } from '@sinclair/typebox';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app';
import { migrate } from '../../apps/api/src/db/migrate';
import { createPool } from '../../apps/api/src/db/pool';
import { createDb } from '../../apps/api/src/db/transaction';
import { assertTestDatabaseUrl, createTestDatabase, type TestDatabase } from '../helpers/database';
import { FixedClock } from '../helpers/clock';

const databases: TestDatabase[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(database => database.close())); });

async function database(): Promise<TestDatabase> {
  const value = await createTestDatabase();
  databases.push(value);
  return value;
}

async function migrations(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'taskio-migrations-'));
  await Promise.all(Object.entries(files).map(([name, sql]) => writeFile(join(directory, name), sql)));
  return directory;
}

describe('migration runner', () => {
  it('applies an empty database once and reports a rerun as a no-op', async () => {
    const testDb = await database();
    const directory = await migrations({ '0001_one.sql': 'CREATE TABLE one (id integer PRIMARY KEY);' });
    expect((await migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory })).applied).toEqual(['0001_one.sql']);
    expect((await migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory })).applied).toEqual([]);
  });

  it('rejects a changed checksum', async () => {
    const testDb = await database();
    const directory = await migrations({ '0001_one.sql': 'SELECT 1;' });
    await migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory });
    await writeFile(join(directory, '0001_one.sql'), 'SELECT 2;');
    await expect(migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory })).rejects.toThrow(/checksum/i);
  });

  it('rejects duplicate versions and migrations added out of order', async () => {
    const duplicateDb = await database();
    const duplicateDirectory = await migrations({ '0001_one.sql': 'SELECT 1;', '0001_two.sql': 'SELECT 2;' });
    await expect(migrate({ databaseUrl: duplicateDb.migratorUrl, migrationsDir: duplicateDirectory })).rejects.toThrow(/duplicate migration version/i);

    const orderedDb = await database();
    const orderedDirectory = await migrations({ '0002_two.sql': 'SELECT 2;' });
    await migrate({ databaseUrl: orderedDb.migratorUrl, migrationsDir: orderedDirectory });
    await writeFile(join(orderedDirectory, '0001_one.sql'), 'SELECT 1;');
    await expect(migrate({ databaseUrl: orderedDb.migratorUrl, migrationsDir: orderedDirectory })).rejects.toThrow(/out of order/i);
  });

  it('rolls a failed migration back completely', async () => {
    const testDb = await database();
    const directory = await migrations({ '0001_bad.sql': 'CREATE TABLE rolled_back (id integer); SELECT missing_column;' });
    await expect(migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory })).rejects.toThrow();
    const pool = createPool(testDb.migratorUrl);
    const result = await pool.query("SELECT to_regclass('public.rolled_back') AS table_name");
    expect(result.rows[0].table_name).toBeNull();
    await pool.end();
  });

  it('serializes concurrent runners', async () => {
    const testDb = await database();
    const directory = await migrations({ '0001_one.sql': 'CREATE TABLE concurrent_one (id integer);' });
    const results = await Promise.all([
      migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory }),
      migrate({ databaseUrl: testDb.migratorUrl, migrationsDir: directory }),
    ]);
    expect(results.flatMap(result => result.applied)).toEqual(['0001_one.sql']);
  });
});

describe('database helpers', () => {
  it('refuses a DSN that is not explicitly marked for tests', () => {
    expect(() => assertTestDatabaseUrl('postgres://user:secret@db/taskio')).toThrow(/refusing/i);
  });

  it('rolls back failed transactions and releases the client', async () => {
    const testDb = await database();
    const pool = createPool(testDb.migratorUrl);
    const db = createDb(pool);
    await expect(db.transaction(async tx => { await tx.query('CREATE TABLE no_commit (id integer)'); throw new Error('stop'); })).rejects.toThrow('stop');
    expect((await pool.query("SELECT to_regclass('public.no_commit') AS table_name")).rows[0].table_name).toBeNull();
    await pool.end();
  });
});

describe('API errors', () => {
  it('uses one safe envelope for validation, not found, and internal errors', async () => {
    const testDb = await database();
    const logs: string[] = [];
    const pool = createPool(testDb.appUrl);
    const app = await createApp({
      db: createDb(pool),
      config: { databaseUrl: testDb.appUrl, origin: 'http://localhost:9090', port: 3000, mode: 'development' },
      clock: new FixedClock(new Date()),
      logger: { level: 'error', stream: { write: (line: string) => logs.push(line) } },
    });
    app.post('/api/v1/probe', { schema: { body: Type.Object({ name: Type.String() }) } }, async () => ({ ok: true }));
    app.post('/api/v1/fail', async () => { throw new Error('database password=super-secret'); });
    await app.ready();

    const invalid = await app.inject({ method: 'POST', url: '/api/v1/probe', payload: {} });
    const malformed = await app.inject({ method: 'POST', url: '/api/v1/probe', headers: { 'content-type': 'application/json' }, payload: '{' });
    const unsupported = await app.inject({ method: 'POST', url: '/api/v1/probe', headers: { 'content-type': 'text/plain' }, payload: 'name=value' });
    const oversized = await app.inject({ method: 'POST', url: '/api/v1/probe', payload: { name: 'x'.repeat(70_000) } });
    const missing = await app.inject({ method: 'GET', url: '/api/v1/missing' });
    const failed = await app.inject({ method: 'POST', url: '/api/v1/fail', headers: { cookie: 'session=private-cookie' }, payload: { password: 'private-body' } });

    expect(invalid.statusCode).toBe(400);
    expect(malformed.statusCode).toBe(400);
    expect(unsupported.statusCode).toBe(415);
    expect(oversized.statusCode).toBe(413);
    expect(missing.statusCode).toBe(404);
    expect(failed.statusCode).toBe(500);
    for (const response of [invalid, malformed, unsupported, oversized, missing, failed]) {
      expect(response.json()).toEqual({ error: expect.objectContaining({ code: expect.any(String), message: expect.any(String), requestId: expect.any(String) }) });
    }
    expect(failed.body).not.toContain('super-secret');
    expect(logs.join('')).not.toMatch(/private-cookie|private-body|super-secret/);
    await app.close();
    await pool.end();
  });
});
