import { Kafka } from "kafkajs";
import { updateOrderStatus,findOrderItemsByOrderId } from "../repositories/order.repository";
import { publishOrderRefunded } from "./orderEvents.publisher";

const kafka = new Kafka({
  clientId: "order-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({ groupId: "order-service-payment-events-group" });

interface PaymentEvent {
  eventType: "PAYMENT_COMPLETED" | "PAYMENT_FAILED" | "REFUND_COMPLETED";
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

      if (
        event.eventType !== "PAYMENT_COMPLETED" &&
        event.eventType !== "PAYMENT_FAILED" &&
        event.eventType !== "REFUND_COMPLETED"
      ) {
        return;
      }

      if (event.eventType === "REFUND_COMPLETED") {
        const updated = await updateOrderStatus(event.orderId, "REFUNDED");
        if (!updated) {
          console.error(`REFUND_COMPLETED received for unknown order ${event.orderId}`);
          return;
        }

        // Now the actual cascade this whole feature is FOR: look up
        // this order's own items (payment-service never had them -
        // only order-service does), and announce them so product-
        // service can restore stock for each one.
        const items = await findOrderItemsByOrderId(event.orderId);
        await publishOrderRefunded(
          event.orderId,
          items.map((item) => ({ productId: item.product_id, quantity: item.quantity }))
        );

        console.log(`Order ${event.orderId} marked REFUNDED, stock restoration announced`);
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