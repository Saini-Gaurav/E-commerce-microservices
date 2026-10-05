import { kafka, PAYMENT_EVENTS_TOPIC } from "./kafka";
import { pushToUser } from "../services/push.service";

const consumer = kafka.consumer({ groupId: "notification-service-payment-events-group" });

interface PaymentEvent {
  eventType: "PAYMENT_COMPLETED" | "PAYMENT_FAILED" | "REFUND_COMPLETED";
  orderId: string;
  paymentId: string;
  userId: string;
  amount?: number;
}

export async function startPaymentEventsConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: PAYMENT_EVENTS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as PaymentEvent;

      // No userId, no push - defensive against any old message on this
      // topic from before userId was added to the payload (the exact
      // poison-pill lesson from earlier in this build).
      if (!event.userId) return;

      const shortId = event.orderId.slice(0, 8);

      if (event.eventType === "PAYMENT_COMPLETED") {
        await pushToUser(
          event.userId,
          "Order confirmed!",
          `Your payment of ₹${event.amount?.toFixed(2)} for order #${shortId} was successful.`,
          { orderId: event.orderId }
        );
      } else if (event.eventType === "REFUND_COMPLETED") {
        await pushToUser(
          event.userId,
          "Refund processed",
          `Your refund for order #${shortId} has been issued.`,
          { orderId: event.orderId }
        );
      }
      // PAYMENT_FAILED deliberately has no push here - the abandoned-
      // order sweep and the retry-payment UI already handle that case
      // visibly in the app; a push for a failed payment risks feeling
      // alarming without a clear next action attached to it.
    },
  });

  console.log("notification-service listening for payment-events");
}