import { Kafka } from "kafkajs";
import { updateOrderStatus } from "../repositories/order.repository";

const kafka = new Kafka({
  clientId: "order-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({ groupId: "order-service-payment-events-group" });

interface PaymentEvent {
  eventType: "PAYMENT_COMPLETED" | "PAYMENT_FAILED";
  orderId: string;
  paymentId: string;
  amount?: number;
}

export async function startPaymentEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: "payment-events", fromBeginning: true });

  await consumer.run({
        eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as PaymentEvent;

      // Same poison-pill discipline as every other consumer - never
      // assume a message's shape just because it arrived on the right topic.
      if (event.eventType !== "PAYMENT_COMPLETED" && event.eventType !== "PAYMENT_FAILED") {
        return;
      }

      const newStatus = event.eventType === "PAYMENT_COMPLETED" ? "PROCESSING" : "CANCELLED";
      const updated = await updateOrderStatus(event.orderId, newStatus);

      if (!updated) {
        console.error(`${event.eventType} received for unknown order ${event.orderId}`);
        return;
      }

      console.log(`Order ${event.orderId} marked ${newStatus} after payment event (${event.paymentId})`);
    },
  });

  console.log("order-service listening for payment-events");
}