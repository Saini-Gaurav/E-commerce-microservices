import { Kafka } from "kafkajs";
import { updateOrderStatus } from "../repositories/order.repository";

const kafka = new Kafka({
  clientId: "order-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({ groupId: "order-service-payment-events-group" });

interface PaymentCompletedEvent {
  eventType: "PAYMENT_COMPLETED";
  orderId: string;
  paymentId: string;
  amount: number;
}

export async function startPaymentEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: "payment-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as PaymentCompletedEvent;
      if (event.eventType !== "PAYMENT_COMPLETED") return;

      // Straight to PROCESSING - PENDING meant "created, not yet paid"; PROCESSING now means "paid, being prepared for shipment." No validation needed here beyond the order existing - by the time this event exists at all, payment-service has ALREADY verified the Razorpay signature. This consumer trusts that verification happened; it doesn't redo it.
      const updated = await updateOrderStatus(event.orderId, "PROCESSING");
      if (!updated) {
        console.error(`PAYMENT_COMPLETED received for unknown order ${event.orderId}`);
        return;
      }

      console.log(`Order ${event.orderId} marked PROCESSING after payment ${event.paymentId}`);
    },
  });

  console.log("order-service listening for payment-events");
}