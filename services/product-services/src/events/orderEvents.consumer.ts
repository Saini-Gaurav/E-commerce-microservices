import { Kafka } from "kafkajs";
import { query } from "../config/db";
import { findProductById, ProductRow } from "../repositories/product.repository";
import { publishProductUpserted } from "./productEvents.publisher";
import { toProductResponse } from "../services/product.service"; // see note below on exporting this

const kafka = new Kafka({
  clientId: "product-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({ groupId: "product-service-order-events-group" });

interface OrderEvent {
  eventType: "ORDER_CREATED" | "ORDER_REFUNDED";
  orderId: string;
  userId?: string;
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

/**
 * No WHERE guard against going negative here, unlike decrementStock -
 * restoring stock can only ever increase the count, so there's no
 * equivalent "not enough stock" failure mode to guard against. Always
 * succeeds if the product still exists.
 */
async function incrementStock(productId: string, quantity: number): Promise<boolean> {
  const result = await query(
    `UPDATE products SET count_in_stock = count_in_stock + $1, updated_at = now() WHERE id = $2`,
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
      const event = JSON.parse(message.value.toString()) as OrderEvent;

      if (event.eventType !== "ORDER_CREATED" && event.eventType !== "ORDER_REFUNDED") {
        return;
      }

      for (const item of event.items) {
        const succeeded =
          event.eventType === "ORDER_CREATED"
            ? await decrementStock(item.productId, item.quantity)
            : await incrementStock(item.productId, item.quantity);

        if (!succeeded) {
          console.error(
            `STOCK ${event.eventType === "ORDER_CREATED" ? "DECREMENT" : "RESTORE"} FAILED for order ${event.orderId}, product ${item.productId}. Manual reconciliation needed.`
          );
          continue;
        }

        // Re-announce the product's new stock count either way - this
        // is what keeps cart-service and order-service's OWN local
        // caches in sync after a refund restores stock, same exact
        // mechanism as after the original decrement.
        const updated: ProductRow | null = await findProductById(item.productId);
        if (updated) {
          await publishProductUpserted(toProductResponse(updated));
        }
      }
    },
  });

  console.log("product-service listening for order-events");
}