import { kafka, PRODUCT_EVENTS_TOPIC } from "./kafka";
import { upsertProductCache, deleteProductCache } from "../repositories/productCache.repository";

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