import express from "express";
import { config } from "./config";
import { roomsRouter } from "./rooms/rooms.routes";

const app = express();
app.use(express.json());
app.use(roomsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});