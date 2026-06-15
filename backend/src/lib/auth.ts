import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Resolve once at startup; fail fast (and keep the type `string`, not
// `string | undefined`, so the hoisted sign/verify functions stay type-safe).
const JWT_SECRET: string = (() => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is required but was not provided.",
    );
  }
  return secret;
})();

export interface TokenPayload {
  userId: number;
  email: string;
  tokenVersion: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    // Reject tokens that were invalidated by a logout (tokenVersion bump).
    const [user] = await db
      .select({ tokenVersion: usersTable.tokenVersion })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId));
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    (req as Request & { adminUser?: TokenPayload }).adminUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
