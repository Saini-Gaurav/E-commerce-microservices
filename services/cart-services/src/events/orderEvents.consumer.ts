import { kafka } from "./kafka";
import { clearCartItems } from "../repositories/cart.repository";

const ORDER_EVENTS_TOPIC = "order-events";

// A distinct groupId from productEvents.consumer.ts's - each consumer within the SAME service still needs its own group, same fan-out reasoning as across different services entirely.
const consumer = kafka.consumer({ groupId: "cart-service-order-events-group" });

interface OrderCreatedEvent {
  eventType: "ORDER_CREATED";
  orderId: string;
  userId: string;
}

export async function startOrderEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: ORDER_EVENTS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as OrderCreatedEvent;

      // Defensive shape check - same poison-pill lesson from payment-service's earlier crash. Never trust an old or malformed message just because it arrived on the right topic.
      if (event.eventType !== "ORDER_CREATED" || typeof event.userId !== "string") {
        return;
      }

      await clearCartItems(event.userId);
      console.log(`Cart cleared for user ${event.userId} after order ${event.orderId}`);
    },
  });

  console.log("cart-service listening for order-events");
}