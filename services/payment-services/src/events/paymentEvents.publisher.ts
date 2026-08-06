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
  amount: number
): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - payment ${paymentId} completed, but order ${orderId} status will NOT auto-update`);
    return;
  }
  await producer.send({
    topic: PAYMENT_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "PAYMENT_COMPLETED", orderId, paymentId, amount }),
    }],
  });
}