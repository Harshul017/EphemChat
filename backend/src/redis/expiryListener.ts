import { redisSub, redisCommand } from "./client";
import { publishToRoom } from "../ws/pubsub";

const EXPIRED_CHANNEL = "__keyevent@0__:expired";

export async function setupExpiryListener(): Promise<void> {
  // Redis doesn't emit key-expiry events by default — this turns them on.
  await redisCommand.config("SET", "notify-keyspace-events", "Ex");

  await redisSub.subscribe(EXPIRED_CHANNEL);

  redisSub.on("message", (channel, expiredKey) => {
    if (channel !== EXPIRED_CHANNEL) return;

    const parts = expiredKey.split(":");

    // Primary room key: room:{id} — exactly one colon.
    // Sibling keys (members, messages, etc.) also expire around the
    // same time and are deliberately ignored here.
    if (parts.length === 2 && parts[0] === "room") {
      const roomId = parts[1];
      if (!roomId) return;
      publishToRoom(roomId, { type: "room_expired" });
      return;
    }

    // Warning key: room:{id}:warning:{leadSeconds}
    // The lead time is encoded in the key name itself, since the key's
    // value is already gone by the time this expiry event fires.
    if (parts.length === 4 && parts[0] === "room" && parts[2] === "warning") {
      const roomId = parts[1];
      const leadPart = parts[3];
      if (!roomId || !leadPart) return;
      const secondsLeft = Number(leadPart);
      publishToRoom(roomId, { type: "room_expiring_soon", secondsLeft });
      return;
    }
  });
}