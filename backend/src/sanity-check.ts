import { redisCommand } from "./redis/client";
import { keys } from "./redis/keys";

async function main() {
  const testKey = keys.room("test123");

  await redisCommand.hset(testKey, { roomName: "Sanity Check Room" });
  await redisCommand.expire(testKey, 30);

  const value = await redisCommand.hgetall(testKey);
  console.log("Stored under key:", testKey);
  console.log("Value read back:", value);

  process.exit(0);
}

main().catch((err) => {
  console.error("Sanity check failed:", err);
  process.exit(1);
});