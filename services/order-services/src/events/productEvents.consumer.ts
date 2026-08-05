import { kafka, PRODUCT_EVENTS_TOPIC } from "./kafka";
import { upsertProductCache, deleteProductCache } from "../repositories/productCache.repository";

// A DIFFERENT groupId than cart-service's "cart-service-group" - this is what makes both services get their own independent copy of every message on this topic, rather than competing for the same messages. This is the Kafka fan-out behavior mentioned in the design brief.
const consumer = kafka.consumer({ groupId: "order-service-group" });

export async function startProductEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: PRODUCT_EVENTS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString());

      if (event.eventType === "PRODUCT_UPSERTED") {
        await upsertProductCache({
          id: event.product.id,
          name: event.product.name,
          price: event.product.price,
          countInStock: event.product.countInStock,
        });
      } else if (event.eventType === "PRODUCT_DELETED") {
        await deleteProductCache(event.productId);
      }
    },
  });

  console.log("order-service listening for product-events");
}