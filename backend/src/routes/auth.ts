import { Router } from "express";
import type { IRouter } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import {
  LoginBody,
  LoginResponse,
  GetMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Throttle login attempts to slow credential brute-forcing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // max attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion });
  res.json(LoginResponse.parse({
    token,
    user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
  }));
});

// Server-side logout: bump tokenVersion so every JWT issued before now is rejected.
router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const admin = (req as typeof req & { adminUser?: { userId: number } }).adminUser;
  if (admin) {
    await db
      .update(usersTable)
      .set({ tokenVersion: sql`${usersTable.tokenVersion} + 1` })
      .where(eq(usersTable.id, admin.userId));
  }
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const admin = (req as typeof req & { adminUser?: { userId: number; email: string } }).adminUser;
  if (!admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, admin.userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(GetMeResponse.parse({ id: user.id, email: user.email, createdAt: user.createdAt.toISOString() }));
});

export default router;
