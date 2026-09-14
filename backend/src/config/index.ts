import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  PORT: z.string().default("8080"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = {
  redisUrl: parsed.data.REDIS_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  port: Number(parsed.data.PORT),
};