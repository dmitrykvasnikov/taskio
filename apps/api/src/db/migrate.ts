import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const migrationName = /^\d{4}_[a-z0-9_]+\.sql$/;
const advisoryLockKey = 842_020_001;

export interface MigrationOptions {
  databaseUrl: string;
  migrationsDir?: string;
}

export interface MigrationResult {
  applied: string[];
  currentVersion: string | null;
}

export async function migrate({
  databaseUrl,
  migrationsDir = path.resolve(__dirname, '../../migrations'),
}: MigrationOptions): Promise<MigrationResult> {
  const files = (await readdir(migrationsDir)).filter(file => migrationName.test(file)).sort();
  const versions = new Set<string>();
  for (const filename of files) {
    const version = filename.slice(0, 4);
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`);
    versions.add(version);
  }
  const migrations = await Promise.all(files.map(async filename => {
    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    return { filename, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));

  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
  let client;
  const applied: string[] = [];
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [advisoryLockKey]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum char(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('REVOKE ALL ON schema_migrations FROM taskio_app');

    const existing = await client.query<{ filename: string; checksum: string }>(
      'SELECT filename, checksum FROM schema_migrations ORDER BY filename',
    );
    const byName = new Map(existing.rows.map(row => [row.filename, row.checksum.trim()]));
    const available = new Set(migrations.map(migration => migration.filename));
    for (const filename of byName.keys()) {
      if (!available.has(filename)) throw new Error(`Applied migration file is missing: ${filename}`);
    }
    const highestApplied = existing.rows.at(-1)?.filename;
    for (const migration of migrations) {
      const checksum = byName.get(migration.filename);
      if (checksum && checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch: ${migration.filename}`);
      }
      if (checksum) continue;
      if (highestApplied && migration.filename < highestApplied) {
        throw new Error(`Migration is out of order: ${migration.filename} follows ${highestApplied}`);
      }
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [migration.filename, migration.checksum],
      );
      applied.push(migration.filename);
    }
    await client.query('COMMIT');
    return { applied, currentVersion: migrations.at(-1)?.filename ?? null };
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the migration error that triggered rollback.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const result = await migrate({ databaseUrl });
  if (result.applied.length === 0) {
    console.log(`No pending migrations (current: ${result.currentVersion ?? 'none'})`);
  } else {
    console.log(`Applied migrations: ${result.applied.join(', ')} (current: ${result.currentVersion})`);
  }
}

if (require.main === module) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
  });
}
