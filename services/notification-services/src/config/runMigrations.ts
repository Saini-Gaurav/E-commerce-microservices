import fs from "fs";
import path from "path";
import { pool } from "./db";

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "migrations");

interface MigrationRow {
  filename: string;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query<MigrationRow>(
    "SELECT filename FROM schema_migrations"
  );
  return new Set(rows.map((r) => r.filename));
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`- skipping ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      console.log(`✓ applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ failed on ${file}:`, (err as Error).message);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log("All migrations up to date.");
  await pool.end();
}

runMigrations();