import { kafkaClient } from "./kafka-client.js";

async function runMonitor() {
  const consumer = kafkaClient.consumer({ groupId: `monitor-${Math.random().toString(36).substr(2, 9)}` });

  await consumer.connect();
  await consumer.subscribe({ topic: "location-updates", fromBeginning: false });

  console.log("\x1b[32m%s\x1b[0m", "Kafka Monitor Started");
  console.log("\x1b[36m%s\x1b[0m", "Listening for live location updates...\n");

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        const time = new Date().toLocaleTimeString();
        
        console.log(
          `[\x1b[90m${time}\x1b[0m] 📍 \x1b[1m\x1b[33m${(data.name || "Unknown").padEnd(15)}\x1b[0m | ` +
          `Lat: \x1b[32m${data.latitude.toFixed(6)}\x1b[0m | ` +
          `Lon: \x1b[32m${data.longitude.toFixed(6)}\x1b[0m`
        );
      } catch (err) {
        console.error("Error parsing message:", err.message);
      }
    },
  });
}

runMonitor().catch((err) => {
  console.error("Monitor failed:", err);
  process.exit(1);
});
