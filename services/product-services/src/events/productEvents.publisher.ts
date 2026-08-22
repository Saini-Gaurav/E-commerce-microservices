import { kafka, PRODUCT_EVENTS_TOPIC } from "./kafka";
import { ProductResponse } from "../services/product.service";

const producer = kafka.producer();
let isConnected = false;

export async function connectProducer(): Promise<void> {
  await producer.connect();
  isConnected = true;
  console.log("Kafka producer connected");
}

// Called after a product is created OR updated - same event type for both, since a cache consumer treats "here's the new full state" the same way either way. No need for separate CREATED vs UPDATED events when the consumer's reaction (overwrite my local copy) is identical.
export async function publishProductUpserted(product: ProductResponse): Promise<void> {
  if (!isConnected) return; // don't crash a request if Kafka happens to be down
  await producer.send({
    topic: PRODUCT_EVENTS_TOPIC,
    messages: [{
      key: product.id, // same key = same partition = guaranteed order for THIS product's events
      value: JSON.stringify({ eventType: "PRODUCT_UPSERTED", product }),
    }],
  });
}

export async function publishProductDeleted(productId: string): Promise<void> {
  if (!isConnected) return;
  await producer.send({
    topic: PRODUCT_EVENTS_TOPIC,
    messages: [{
      key: productId,
      value: JSON.stringify({ eventType: "PRODUCT_DELETED", productId }),
    }],
  });
}

export async function disconnectProducer(): Promise<void> {
  await producer.disconnect();
  isConnected = false;
  console.log("Kafka producer disconnected");
}