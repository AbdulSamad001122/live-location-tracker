import mongoose from "mongoose";
import { kafkaClient } from "./kafka-client.js";
import dotenv from "dotenv";
import { Location } from "./models/Location.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27019/location_tracker";

async function init() {
  try {
    await mongoose.connect(MONGO_URI);

    const kafkaConsumer = kafkaClient.consumer({
      groupId: "database-processor-group",
    });

    await kafkaConsumer.connect();

    await kafkaConsumer.subscribe({
      topics: ["location-updates"],
      fromBeginning: true,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const newLocation = new Location({
            userId: data.id,
            name: data.name,
            email: data.email,
            latitude: data.latitude,
            longitude: data.longitude,
          });

          await newLocation.save();
          await heartbeat();
        } catch (err) {
          console.error("Error processing message:", err.message);
        }
      },
    });
  } catch (err) {
    console.error("Critical error in database-processor:", err);
    process.exit(1);
  }
}

init();
