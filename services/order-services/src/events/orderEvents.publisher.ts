import { kafka, ORDER_EVENTS_TOPIC } from "./kafka";

const producer = kafka.producer();
let isConnected = false;

export async function connectOrderEventsProducer(): Promise<void> {
  await producer.connect();
  isConnected = true;
  console.log("order-service Kafka producer connected");
}

export interface OrderCreatedEventItem {
  productId: string;
  quantity: number;
}

/**
 * Announces "this order was just placed" - product-service listens for
 * this to decrement its own stock. Fired AFTER the order is already
 * safely saved in this service's own database, never before - if
 * Kafka were somehow down, we'd rather have an order that exists but
 * hasn't reduced stock yet, than fail to save the order at all over a
 * messaging problem that has nothing to do with "did this order happen."
 */
export async function publishOrderCreated(
  orderId: string,
  userId: string,
  items: OrderCreatedEventItem[],
  totalPrice: number   // <-- add this parameter
): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - order ${orderId} created, but stock will NOT be decremented`);
    return;
  }
  await producer.send({
    topic: ORDER_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "ORDER_CREATED", orderId, userId, items, totalPrice }), // <-- add totalPrice here
    }],
  });
}