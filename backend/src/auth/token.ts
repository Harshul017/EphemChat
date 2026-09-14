import jwt from "jsonwebtoken";
import { config } from "../config";

export type Role = "admin" | "member";

export interface TokenPayload {
  roomId: string;
  userId: string;
  role: Role;
}

export function signToken(payload: TokenPayload, expiresInSeconds: number): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}