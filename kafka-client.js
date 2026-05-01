import { Kafka } from "kafkajs";
import dotenv from "dotenv";

dotenv.config();

const kafkaConfig = {
  clientId: "live-location-tracking-app",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
};

if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
  kafkaConfig.ssl = true;
  kafkaConfig.sasl = {
    mechanism: "scram-sha-256",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  };
}

export const kafkaClient = new Kafka(kafkaConfig);
