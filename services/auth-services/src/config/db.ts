import { Pool, QueryResult, QueryResultRow, PoolClient } from "pg";
import "dotenv/config";

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 5000,
});

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle Postgres client", err);
});

// Generic <T> lets every caller describe the SHAPE of the rows it expects back, e.g. query<UserRow>("SELECT * FROM users WHERE id = $1", [id]) gives you result.rows[0].email with full autocomplete + type safety, instead of `any`.
function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { pool, query, getClient };