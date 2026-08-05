import { Kafka } from "kafkajs";
import { query } from "../config/db";
import { findProductById, ProductRow } from "../repositories/order.repository";
import { publishProductUpserted } from "./productEvents.consumer";
import { toProductResponse } from "../services/order.service"; // see note below on exporting this

const kafka = new Kafka({
  clientId: "product-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({ groupId: "product-service-order-events-group" });

interface OrderCreatedEvent {
  eventType: "ORDER_CREATED";
  orderId: string;
  userId: string;
  items: { productId: string; quantity: number }[];
}

/**
 * The atomic guard here is the actual safety net for the race condition
 * named back in the design brief: "what if stock changed between
 * order-service validating it and this update actually running."
 * `WHERE count_in_stock >= $2` means the update either succeeds AND
 * proves there was enough stock at the exact instant it ran, or
 * affects zero rows - there's no window where two concurrent orders
 * could both read "5 in stock" and both successfully subtract, ending
 * up negative. Postgres's row-level locking during the UPDATE makes
 * this safe even under real concurrent traffic, not just in theory.
 */
async function decrementStock(productId: string, quantity: number): Promise<boolean> {
  const result = await query(
    `UPDATE products SET count_in_stock = count_in_stock - $1, updated_at = now()
     WHERE id = $2 AND count_in_stock >= $1`,
    [quantity, productId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function startOrderEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: "order-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as OrderCreatedEvent;
      if (event.eventType !== "ORDER_CREATED") return;

      for (const item of event.items) {
        const succeeded = await decrementStock(item.productId, item.quantity);

        if (!succeeded) {
          // Known, named gap from the design brief: this is exactly
          // where a real saga would publish a compensating event
          // (e.g. "STOCK_RESERVATION_FAILED") for order-service to
          // hear and cancel the order. Not built yet - logged loudly
          // instead, so it's visible rather than silently wrong.
          console.error(
            `STOCK DECREMENT FAILED for order ${event.orderId}, product ${item.productId}: insufficient stock. Order was already created - manual reconciliation needed.`
          );
          continue;
        }

        // Re-announce the product's new state so cart-service AND
        // order-service's local caches both pick up the reduced stock
        // number automatically - same publish function product-service
        // already calls from createProduct/updateProduct, reused here.
        const updated: ProductRow | null = await findProductById(item.productId);
        if (updated) {
          await publishProductUpserted(toProductResponse(updated));
        }
      }
    },
  });

  console.log("product-service listening for order-events");
}