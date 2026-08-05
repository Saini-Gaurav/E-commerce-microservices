import "dotenv/config";
import app from "./app";
import { pool } from "./config/db";
import { connectProducer } from "./events/productEvents.publisher";
import { startOrderEventsConsumer } from "./events/orderEvents.consumer";

const PORT = process.env.PORT || 4002;

async function start(): Promise<void> {
  // No RBAC cache to load anymore. Still confirm the DB is reachable  before accepting traffic - a service that "starts" but can't reach its own database should never look healthy to a load balancer.
  await pool.query("SELECT 1");
  await startOrderEventsConsumer();
  await connectProducer();

  app.listen(PORT, () => {
    console.log(`product-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start product-service:", err);
  process.exit(1);
});