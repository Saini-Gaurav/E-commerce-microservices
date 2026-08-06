import "dotenv/config";
import app from "./app";
import { pool } from "./config/db";
import { startOrderEventsConsumer } from "./events/orderEvents.consumer";
import { connectPaymentEventsProducer } from "./events/paymentEvents.publisher";

const PORT = process.env.PORT || 4005;

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  await startOrderEventsConsumer();       // fills order_cache
  await connectPaymentEventsProducer();   // ready to announce PAYMENT_COMPLETED

  app.listen(PORT, () => {
    console.log(`payment-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start payment-service:", err);
  process.exit(1);
});