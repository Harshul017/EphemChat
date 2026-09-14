import { Router } from "express";
import { z } from "zod";
import {
  createRoom,
  getRoomInfo,
  requestToJoin,
  approveRequest,
  getMessages,
  getPendingRequests,
  getRequestStatus,
} from "./rooms.service";
import { signToken } from "../auth/token";
import { requireAuth, AuthedRequest } from "../auth/middleware";
import { redisCommand } from "../redis/client";
import { keys } from "../redis/keys";

export const roomsRouter = Router();

const createRoomSchema = z.object({
  roomName: z.string().min(1).max(80),
  adminName: z.string().min(1).max(40),
  ttlSeconds: z.number().int().min(60).max(7200),
  warningLeadSeconds: z.number().int().min(5).max(600).optional(),
});

const roomParamsSchema = z.object({
  roomId: z.string(),
});

const approveParamsSchema = z.object({
  roomId: z.string(),
  requestId: z.string(),
});

const joinRequestSchema = z.object({ name: z.string().min(1).max(40) });

roomsRouter.post("/rooms", async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  const { roomName, adminName, ttlSeconds, warningLeadSeconds } = parsed.data;
  const { roomId, adminId } = await createRoom(roomName, adminName, ttlSeconds, warningLeadSeconds);

  const token = signToken({ roomId, userId: adminId, role: "admin" }, ttlSeconds);

  res.status(201).json({ roomId, token });
});

roomsRouter.get("/rooms/:roomId/messages", requireAuth(), async (req: AuthedRequest, res) => {
  const { roomId } = roomParamsSchema.parse(req.params);
  const messages = await getMessages(roomId);
  res.json(messages);
});

roomsRouter.get("/rooms/:roomId", async (req, res) => {
  const { roomId } = roomParamsSchema.parse(req.params);

  const info = await getRoomInfo(roomId);
  if (!info) {
    return res.status(404).json({ error: "Room not found or expired" });
  }
  res.json(info);
});

roomsRouter.post("/rooms/:roomId/requests", async (req, res) => {
  const { roomId } = roomParamsSchema.parse(req.params);

  const parsed = joinRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  try {
    const requestId = await requestToJoin(roomId, parsed.data.name);
    res.status(201).json({ requestId });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

roomsRouter.get(
  "/rooms/:roomId/requests",
  requireAuth("admin"),
  async (req: AuthedRequest, res) => {
    const { roomId } = roomParamsSchema.parse(req.params);
    const requests = await getPendingRequests(roomId);
    res.json(requests);
  }
);

// No auth required — the visitor doesn't have a token yet. Safe because
// requestId is an unguessable server-generated UUID, and this route only
// ever hands back a token scoped to that exact requestId.
roomsRouter.get("/rooms/:roomId/requests/:requestId/status", async (req, res) => {
  const { roomId, requestId } = approveParamsSchema.parse(req.params);
  const status = await getRequestStatus(roomId, requestId);

  if (status === "approved") {
    const ttl = await redisCommand.ttl(keys.room(roomId));
    const token = signToken({ roomId, userId: requestId, role: "member" }, ttl);
    return res.json({ status, token });
  }

  res.json({ status });
});

roomsRouter.post(
  "/rooms/:roomId/requests/:requestId/approve",
  requireAuth("admin"),
  async (req: AuthedRequest, res) => {
    const { roomId, requestId } = approveParamsSchema.parse(req.params);

    try {
      const { userId, name } = await approveRequest(roomId, requestId);
      const ttl = await redisCommand.ttl(keys.room(roomId));
      const token = signToken({ roomId, userId, role: "member" }, ttl);
      res.json({ userId, name, token });
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  }
);