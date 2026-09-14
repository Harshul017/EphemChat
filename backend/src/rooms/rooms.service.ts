import { randomUUID } from "crypto";
import { redisCommand } from "../redis/client";
import { keys } from "../redis/keys";

export interface CreateRoomResult {
  roomId: string;
  adminId: string;
}

export async function createRoom(
  roomName: string,
  adminName: string,
  ttlSeconds: number
): Promise<CreateRoomResult> {
  const roomId = randomUUID();
  const adminId = randomUUID();

  const roomKey = keys.room(roomId);
  const membersKey = keys.members(roomId);
  const adminMemberKey = keys.member(roomId, adminId);
  const now = new Date().toISOString();

  const tx = redisCommand.multi();
  tx.hset(roomKey, { roomName, adminId, createdAt: now });
  tx.expire(roomKey, ttlSeconds);
  tx.sadd(membersKey, adminId);
  tx.expire(membersKey, ttlSeconds);
  tx.hset(adminMemberKey, { name: adminName, joinedAt: now });
  tx.expire(adminMemberKey, ttlSeconds);

  const results = await tx.exec();
  if (!results) throw new Error("Redis transaction failed to execute");
  for (const [err] of results) {
    if (err) throw err;
  }

  return { roomId, adminId };
}

export async function getRoomInfo(roomId: string) {
  const roomKey = keys.room(roomId);
  const exists = await redisCommand.exists(roomKey);
  if (!exists) return null;

  const roomName = await redisCommand.hget(roomKey, "roomName");
  return { roomId, roomName };
}

export async function isMember(roomId: string, userId: string): Promise<boolean> {
  const result = await redisCommand.sismember(keys.members(roomId), userId);
  return result === 1;
}

// Reads the room's current remaining TTL and applies it to any sibling
// keys passed in. This is what keeps messages/members from ever going
// stale relative to the room itself — no key gets its own independent
// fixed TTL after creation.
export async function refreshRoomTTL(roomId: string, ...siblingKeys: string[]): Promise<number> {
  const ttl = await redisCommand.ttl(keys.room(roomId));
  if (ttl > 0 && siblingKeys.length > 0) {
    const tx = redisCommand.multi();
    for (const key of siblingKeys) {
      tx.expire(key, ttl);
    }
    await tx.exec();
  }
  return ttl;
}

export async function requestToJoin(roomId: string, name: string): Promise<string> {
  const requestId = randomUUID();
  const requestsKey = keys.requests(roomId);
  const ttl = await redisCommand.ttl(keys.room(roomId));
  if (ttl <= 0) throw new Error("Room does not exist or has expired");

  const tx = redisCommand.multi();
  tx.hset(`${requestsKey}:${requestId}`, { name });
  tx.expire(`${requestsKey}:${requestId}`, ttl);
  tx.sadd(requestsKey, requestId);
  tx.expire(requestsKey, ttl);
  await tx.exec();

  return requestId;
}

export async function approveRequest(roomId: string, requestId: string): Promise<{ userId: string; name: string }> {
  const requestHashKey = `${keys.requests(roomId)}:${requestId}`;
  const name = await redisCommand.hget(requestHashKey, "name");
  if (!name) throw new Error("Join request not found or expired");

  const userId = requestId; // reuse the request's id as the member's id
  const ttl = await redisCommand.ttl(keys.room(roomId));

  const tx = redisCommand.multi();
  tx.srem(keys.requests(roomId), requestId);
  tx.del(requestHashKey);
  tx.sadd(keys.members(roomId), userId);
  tx.expire(keys.members(roomId), ttl);
  tx.hset(keys.member(roomId, userId), { name, joinedAt: new Date().toISOString() });
  tx.expire(keys.member(roomId, userId), ttl);
  await tx.exec();

  return { userId, name };
}