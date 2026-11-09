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

export interface RefundedOrderItem {
  productId: string;
  quantity: number;
}

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

export async function publishOrderRefunded(
  orderId: string,
  items: RefundedOrderItem[]
): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - refund for order ${orderId} will NOT restore stock`);
    return;
  }
  await producer.send({
    topic: ORDER_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "ORDER_REFUNDED", orderId, items }),
    }],
  });
}

export async function publishOrderCancelled(
  orderId: string,
  items: RefundedOrderItem[]
): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - cancelled order ${orderId} will NOT restore stock`);
    return;
  }
  await producer.send({
    topic: ORDER_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "ORDER_CANCELLED", orderId, items }),
    }],
  });
}

export async function publishOrderStatusUpdated(
  orderId: string,
  userId: string,
  status: string
): Promise<void> {
  if (!isConnected) {
    console.warn(`Kafka producer not connected - status change for order ${orderId} will NOT notify the customer`);
    return;
  }
  await producer.send({
    topic: ORDER_EVENTS_TOPIC,
    messages: [{
      key: orderId,
      value: JSON.stringify({ eventType: "ORDER_STATUS_UPDATED", orderId, userId, status }),
    }],
  });
}