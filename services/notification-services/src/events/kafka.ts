import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "notification-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

export const PAYMENT_EVENTS_TOPIC = "payment-events";
export const ORDER_EVENTS_TOPIC = "order-events";