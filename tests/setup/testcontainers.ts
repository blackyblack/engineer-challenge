import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared test setup for PostgreSQL via testcontainers.
 *
 * Provides a real PostgreSQL instance for integration/application tests,
 * eliminating the need for in-memory repository stubs.
 */

let container: StartedPostgreSqlContainer | null = null;
let pool: Pool | null = null;

export async function startPostgres(): Promise<Pool> {
  if (pool) return pool;

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('auth_db')
    .withUsername('auth')
    .withPassword('auth')
    .start();

  pool = new Pool({ connectionString: container.getConnectionUri() });

  // Run migrations
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
  }

  return pool;
}

export async function cleanTables(p: Pool): Promise<void> {
  await p.query('DELETE FROM reset_tokens');
  await p.query('DELETE FROM domain_events');
  await p.query('DELETE FROM users');
}

export async function stopPostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (container) {
    await container.stop();
    container = null;
  }
}

export function getPool(): Pool {
  if (!pool) throw new Error('PostgreSQL not started. Call startPostgres() first.');
  return pool;
}
