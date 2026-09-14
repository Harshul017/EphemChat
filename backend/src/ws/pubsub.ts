import { redisPub, redisSub } from "../redis/client";

const CHANNEL_PATTERN = "room:*:events";

export function publishToRoom(roomId: string, event: unknown): void {
  redisPub.publish(`room:${roomId}:events`, JSON.stringify(event));
}

// Subscribes ONCE per process to every room's event channel via a pattern
// match, and hands each incoming event to the given callback along with
// which room it belongs to. The callback is responsible for delivering it
// to whatever local sockets this instance happens to be holding.
export function subscribeToRoomEvents(
  onEvent: (roomId: string, event: unknown) => void
): void {
  redisSub.psubscribe(CHANNEL_PATTERN);

  redisSub.on("pmessage", (_pattern, channel, message) => {
    const roomId = channel.split(":")[1];
    if (!roomId) return;

    try {
      const event = JSON.parse(message);
      onEvent(roomId, event);
    } catch {
      // malformed payload on the channel — ignore rather than crash
    }
  });
}