import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://auth:auth@localhost:5432/auth_db';
  const pool = new Pool({ connectionString: dbUrl });

  const migrationsDir = path.resolve(__dirname, '../../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`Migration ${file} completed`);
  }

  await pool.end();
  console.log('All migrations completed');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
