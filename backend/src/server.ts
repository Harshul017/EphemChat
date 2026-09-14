import express from "express";
import { createServer } from "http";
import { config } from "./config";
import { roomsRouter } from "./rooms/rooms.routes";
import { setupWebSocketServer } from "./ws/wsServer";

const app = express();
app.use(express.json());
app.use(roomsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);
setupWebSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});