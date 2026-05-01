import { Kafka } from "kafkajs";

export const kafkaClient = new Kafka({
  clientId: "live-location-tracking-app",
  brokers: ["localhost:9092"],
});
