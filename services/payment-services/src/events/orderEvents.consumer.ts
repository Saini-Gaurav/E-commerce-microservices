import { kafka, ORDER_EVENTS_TOPIC } from "./kafka";
import { upsertOrderCache } from "../repositories/orderCache.repository";

const consumer = kafka.consumer({ groupId: "payment-service-group" });

interface OrderCreatedEvent {
  eventType: "ORDER_CREATED";
  orderId: string;
  userId: string;
  items: { productId: string; quantity: number }[];
  totalPrice: number;
}

export async function startOrderEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: ORDER_EVENTS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as OrderCreatedEvent;
      if (event.eventType !== "ORDER_CREATED") return;

      await upsertOrderCache({
        orderId: event.orderId,
        userId: event.userId,
        totalPrice: event.totalPrice,
      });
    },
  });

  console.log("payment-service listening for order-events");
}