import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { verifyToken } from "./middleware/auth.js";
import { kafkaClient } from "./kafka-client.js";
import mongoose from "mongoose";
import { Location } from "./models/Location.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27019/location_tracker";

async function main() {
  const PORT = process.env.PORT || 8000;
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(join(__dirname, "public")));

  const kafkaProducer = kafkaClient.producer();
  await kafkaProducer.connect();

  try {
    await mongoose.connect(MONGO_URI);
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }

  const kafkaConsumer = kafkaClient.consumer({
    groupId: `socket-server-${PORT}`,
  });

  await kafkaConsumer.connect();

  await kafkaConsumer.subscribe({
    topics: ["location-updates"],
    fromBeginning: true,
  });

  kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const data = JSON.parse(message.value.toString());
      
      try {
        const newLocation = new Location({
          userId: data.id,
          name: data.name,
          email: data.email,
          latitude: data.latitude,
          longitude: data.longitude,
        });
        await newLocation.save();
      } catch (err) {
        console.error("Error saving location to DB:", err);
      }

      io.emit("server:send-new-location-to-users", {
        id: data.id,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      await heartbeat();
    },
  });

  const socketUserMap = new Map();

  app.post("/api/callback", async (req, res) => {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: "Missing code or redirectUri" });
    }

    try {
      const response = await fetch(process.env.OIDC_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: process.env.OIDC_CLIENT_ID,
          client_secret: process.env.OIDC_CLIENT_SECRET,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Token exchange failed" });
    }
  });

  app.get("/health", (req, res) => {
    res.send("Server is healthy!");
  });

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "public", "index.html"));
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    try {
      const user = await verifyToken(token);
      if (!user) {
        return next(new Error("Unauthorized"));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    const userId = user.id || user.sub;
    socketUserMap.set(socket.id, userId);

    socket.on("client:send-location-to-server", async (data) => {
      if (
        !data ||
        typeof data.latitude !== "number" ||
        typeof data.longitude !== "number"
      )
        return;

      try {
        await kafkaProducer.send({
          topic: "location-updates",
          messages: [
            {
              key: userId,
              value: JSON.stringify({
                id: userId,
                name: user.name || user.email || "Anonymous",
                email: user.email || "",
                latitude: data.latitude,
                longitude: data.longitude,
              }),
            },
          ],
        });
      } catch (err) {
        console.error("Failed to send message to Kafka:", err);
      }
    });

    socket.on("disconnect", () => {
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        io.emit("user-disconnect", userId);
        socketUserMap.delete(socket.id);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
