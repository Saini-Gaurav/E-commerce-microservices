import { kafka } from "./kafka";
import { clearCartItems } from "../repositories/cart.repository";
import { broadcastCartToUser } from "./sseManager";

const ORDER_EVENTS_TOPIC = "order-events";

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

      if (event.eventType !== "ORDER_CREATED" || typeof event.userId !== "string") {
        return;
      }

      await clearCartItems(event.userId);
      broadcastCartToUser(event.userId, { items: [], itemCount: 0, subtotal: 0 });
      console.log(`Cart cleared for user ${event.userId} after order ${event.orderId}`);
    },
  });

  console.log("cart-service listening for order-events");
}