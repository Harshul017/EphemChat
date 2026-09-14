import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { verifyToken } from "../auth/token";
import { isMember, saveMessage } from "../rooms/rooms.service";
import { redisCommand } from "../redis/client";
import { keys } from "../redis/keys";
import { publishToRoom, subscribeToRoomEvents } from "./pubsub";

interface AuthedSocket extends WebSocket {
  roomId: string;
  userId: string;
  name: string;
}

// Tracks which sockets on THIS instance belong to which room.
// Delivery to these sockets now happens ONLY via the pub/sub
// subscription below — never directly from an event handler —
// so one instance or ten behave identically.
const rooms = new Map<string, Set<AuthedSocket>>();

function deliverToLocalSockets(roomId: string, event: unknown) {
  const sockets = rooms.get(roomId);
  if (!sockets) return;
  const data = JSON.stringify(event);
  for (const client of sockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Wired once per process, independent of how many sockets connect.
subscribeToRoomEvents(deliverToLocalSockets);

export function setupWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Auth happens here, BEFORE the connection is ever upgraded.
  httpServer.on("upgrade", async (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const stillMember = await isMember(payload.roomId, payload.userId);
    if (!stillMember) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const authed = ws as AuthedSocket;
      authed.roomId = payload.roomId;
      authed.userId = payload.userId;
      wss.emit("connection", authed, req);
    });
  });

  wss.on("connection", async (ws: AuthedSocket) => {
    const storedName = await redisCommand.hget(keys.member(ws.roomId, ws.userId), "name");
    ws.name = storedName ?? "unknown";

    if (!rooms.has(ws.roomId)) rooms.set(ws.roomId, new Set());
    rooms.get(ws.roomId)!.add(ws);

    publishToRoom(ws.roomId, { type: "user_joined", userId: ws.userId, name: ws.name });

    ws.on("message", async (raw) => {
      let parsed: { type?: string; text?: string };
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (parsed.type === "message" && typeof parsed.text === "string" && parsed.text.trim()) {
        try {
          await saveMessage(ws.roomId, ws.userId, ws.name, parsed.text);
        } catch {
          ws.close(4410, "Room expired");
          return;
        }

        publishToRoom(ws.roomId, {
          type: "message",
          userId: ws.userId,
          name: ws.name,
          text: parsed.text,
          ts: Date.now(),
        });
      }
    });

    ws.on("close", () => {
      rooms.get(ws.roomId)?.delete(ws);
      if (rooms.get(ws.roomId)?.size === 0) rooms.delete(ws.roomId);
      publishToRoom(ws.roomId, { type: "user_left", userId: ws.userId });
    });
  });
}