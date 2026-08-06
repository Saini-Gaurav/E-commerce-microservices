import "dotenv/config";
import app from "./app";
import { pool } from "./config/db";
import { startProductEventsConsumer } from "./events/productEvents.consumer";
import { connectOrderEventsProducer } from "./events/orderEvents.publisher";
import { startPaymentEventsConsumer } from "./events/paymentEvents.consumer";

const PORT = process.env.PORT || 4004;

async function start(): Promise<void> {
  await pool.query("SELECT 1"); // fail fast if DB unreachable

  // Order matters here: start LISTENING for product info before announcing that we're ready to take orders - otherwise the very first order request could arrive while product_cache is still empty, which is the same eventual-consistency gap named earlier, just made slightly less likely by simply not racing it at boot.
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