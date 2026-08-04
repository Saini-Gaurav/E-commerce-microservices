import "dotenv/config";
import app from "./app";
import { pool } from "./config/db";
import { startProductEventsConsumer } from "./events/productEvents.consumer";

const PORT = process.env.PORT || 4003;

async function start(): Promise<void> {
  await pool.query("SELECT 1"); // fail fast if the database isn't reachable
  await startProductEventsConsumer();
  app.listen(PORT, () => {
    console.log(`cart-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start cart-service:", err);
  process.exit(1);
});