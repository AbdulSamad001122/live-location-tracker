import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { verifyToken } from "./middleware/auth.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

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

io.on("connection", (socket) => {
  socket.on("client:send-location-to-server", async (data) => {
    const user = await verifyToken(data.token);
    
    if (!user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    const userId = user.id || user.sub;
    socketUserMap.set(socket.id, userId);

    if (
      !data ||
      typeof data.latitude !== "number" ||
      typeof data.longitude !== "number"
    )
      return;

    io.emit("server:send-new-location-to-users", {
      id: userId,
      name: user.name || user.email || "Anonymous",
      latitude: data.latitude,
      longitude: data.longitude,
    });
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
