import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "order-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

export const PRODUCT_EVENTS_TOPIC = "product-events";
export const ORDER_EVENTS_TOPIC = "order-events";