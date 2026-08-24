import "dotenv/config";
import app from "./app";
import { pool } from "./config/db";

const PORT = process.env.PORT || 4006;

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  app.listen(PORT, () => {
    console.log(`notification-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start notification-service:", err);
  process.exit(1);
});