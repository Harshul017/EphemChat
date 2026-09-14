import Redis from "ioredis";
import { config } from "../config";

// Normal commands: GET, SET, HSET, SADD, etc.
export const redisCommand = new Redis(config.redisUrl);

// Dedicated connection for SUBSCRIBE — never issue other commands on this one.
export const redisSub = new Redis(config.redisUrl);

// Dedicated connection for PUBLISH.
export const redisPub = new Redis(config.redisUrl);

[redisCommand, redisSub, redisPub].forEach((client, i) => {
  client.on("error", (err) => {
    console.error(`Redis client ${i} error:`, err.message);
  });
});