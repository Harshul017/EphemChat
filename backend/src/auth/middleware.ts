import { Request, Response, NextFunction } from "express";
import { verifyToken, Role } from "./token";
import { isMember } from "../rooms/rooms.service";

export interface AuthedRequest extends Request {
  auth?: { roomId: string; userId: string; role: Role };
}

export function requireAuth(requiredRole?: Role) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }

    const token = header.slice("Bearer ".length);

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (requiredRole && payload.role !== requiredRole) {
      return res.status(403).json({ error: `Requires role: ${requiredRole}` });
    }

    // Token says who you claim to be. Redis confirms you're still actually
    // approved — this catches a member who was removed after their token
    // was issued but before it expired.
    const stillMember = await isMember(payload.roomId, payload.userId);
    if (!stillMember) {
      return res.status(403).json({ error: "No longer a member of this room" });
    }

    req.auth = payload;
    next();
  };
}