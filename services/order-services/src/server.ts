import "dotenv/config";
import app from "./app";
import { pool } from "./config/db";
import { startProductEventsConsumer } from "./events/productEvents.consumer";
import { connectOrderEventsProducer } from "./events/orderEvents.publisher";
import { startPaymentEventsConsumer } from "./events/paymentEvents.consumer";

const PORT = process.env.PORT || 4004;

async function start(): Promise<void> {
  await pool.query("SELECT 1"); // fail fast if DB unreachable

  await startProductEventsConsumer();
  await connectOrderEventsProducer();
  await startPaymentEventsConsumer();

  app.listen(PORT, () => {
    console.log(`order-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start order-service:", err);
  process.exit(1);
});