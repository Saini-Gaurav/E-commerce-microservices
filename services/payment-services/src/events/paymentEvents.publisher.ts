import { kafka, PAYMENT_EVENTS_TOPIC } from "./kafka";

const producer = kafka.producer();
let isConnected = false;

export async function connectPaymentEventsProducer(): Promise<void> {
  await producer.connect();
  isConnected = true;
  console.log("payment-service Kafka producer connected");
}

/**
 * Announces "this order's payment succeeded" - order-service will
 * listen for this and flip the order's status from PENDING to
 * PROCESSING automatically, closing the loop the same way
 * product-service reacts to ORDER_CREATED.
 */
export async function publishPaymentCompleted(
  orderId: string,
  paymentId: string,
  userId: string,
  amount: number
): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - order ${orderId} payment completed but downstream consumers won't be notified`);
    return;
  }
  await producer.send({
    topic: PAYMENT_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "PAYMENT_COMPLETED", orderId, paymentId, userId, amount }),
    }],
  });
}

export async function publishPaymentFailed(orderId: string, paymentId: string, userId: string): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - payment failure for order ${orderId} will NOT auto-cancel it`);
    return;
  }
  await producer.send({
    topic: PAYMENT_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "PAYMENT_FAILED", orderId, paymentId, userId }),
    }],
  });
}

export async function publishRefundCompleted(orderId: string, paymentId: string, userId: string): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - refund for order ${orderId} will NOT auto-cascade`);
    return;
  }
  await producer.send({
    topic: PAYMENT_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "REFUND_COMPLETED", orderId, paymentId, userId }),
    }],
  });
}