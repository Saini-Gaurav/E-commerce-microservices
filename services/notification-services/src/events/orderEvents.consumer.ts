import { kafka, ORDER_EVENTS_TOPIC } from "./kafka";
import { pushToUser } from "../services/push.service";

const consumer = kafka.consumer({ groupId: "notification-service-order-events-group" });

interface OrderEvent {
  eventType: string;
  orderId: string;
  userId?: string;
  status?: string;
}

const STATUS_MESSAGES: Record<string, { title: string; body: (shortId: string) => string }> = {
  SHIPPED: { title: "Your order has shipped!", body: (id) => `Order #${id} is on its way.` },
  DELIVERED: { title: "Order delivered", body: (id) => `Order #${id} has arrived. Enjoy!` },
};

export async function startOrderEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: ORDER_EVENTS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as OrderEvent;

      if (event.eventType !== "ORDER_STATUS_UPDATED" || !event.userId || !event.status) return;

      // Only SHIPPED/DELIVERED get a push - PROCESSING/CANCELLED/
      // REFUNDED are already covered by the payment-events consumer
      // above, reacting to the actual payment outcome that caused them.
      const config = STATUS_MESSAGES[event.status];
      if (!config) return;

      await pushToUser(event.userId, config.title, config.body(event.orderId.slice(0, 8)), {
        orderId: event.orderId,
      });
    },
  });

  console.log("notification-service listening for order-events");
}