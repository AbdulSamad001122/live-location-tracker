import { kafkaClient } from "./kafka-client.js";

async function setup() {
  const admin = kafkaClient.admin();

  console.log("Kafka admin connecting...");
  await admin.connect();
  console.log("Kafka admin connection success");

  await admin.createTopics({
    topics: [{ topic: "location-updates", numPartitions: 2 }],
  });

  await admin.disconnect();

  console.log("Kafka admin disconnected...");
}

setup();
