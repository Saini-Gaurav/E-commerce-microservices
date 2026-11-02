import { Kafka } from "kafkajs";
import { query } from "../config/db";
import {
  findProductById,
  ProductRow,
} from "../repositories/product.repository";
import { publishProductUpserted } from "./productEvents.publisher";
import { toProductResponse } from "../services/product.service"; // see note below on exporting this
import { recordPurchase } from "../repositories/productPurchase.repository";

const kafka = new Kafka({
  clientId: "product-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({
  groupId: "product-service-order-events-group",
});

interface OrderEvent {
  eventType: "ORDER_CREATED" | "ORDER_REFUNDED" | "ORDER_CANCELLED";
  orderId: string;
  userId?: string;
  items: { productId: string; quantity: number }[];
}

async function decrementStock(
  productId: string,
  quantity: number,
): Promise<boolean> {
  const result = await query(
    `UPDATE products SET count_in_stock = count_in_stock - $1, updated_at = now()
     WHERE id = $2 AND count_in_stock >= $1`,
    [quantity, productId],
  );
  return (result.rowCount ?? 0) > 0;
}

async function incrementStock(
  productId: string,
  quantity: number,
): Promise<boolean> {
  const result = await query(
    `UPDATE products SET count_in_stock = count_in_stock + $1, updated_at = now() WHERE id = $2`,
    [quantity, productId],
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

      if (
        event.eventType !== "ORDER_CREATED" &&
        event.eventType !== "ORDER_REFUNDED" &&
        event.eventType !== "ORDER_CANCELLED"
      ) {
        return;
      }

      for (const item of event.items) {
        if (event.eventType === "ORDER_CREATED" && event.userId) {
          await recordPurchase(event.userId, item.productId);
        }
        const succeeded =
          event.eventType === "ORDER_CREATED"
            ? await decrementStock(item.productId, item.quantity)
            : await incrementStock(item.productId, item.quantity);

        if (!succeeded) {
          console.error(
            `STOCK ${event.eventType === "ORDER_CREATED" ? "DECREMENT" : "RESTORE"} FAILED for order ${event.orderId}, product ${item.productId}. Manual reconciliation needed.`,
          );
          continue;
        }

        const updated: ProductRow | null = await findProductById(
          item.productId,
        );
        if (updated) {
          await publishProductUpserted(toProductResponse(updated));
        }
      }
    },
  });

  console.log("product-service listening for order-events");
}
