import { Router } from "express";
import type { IRouter } from "express";
import { db, plansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListPlansResponse,
  CreatePlanBody,
  GetPlanParams,
  GetPlanResponse,
  UpdatePlanParams,
  UpdatePlanBody,
  UpdatePlanResponse,
  DeletePlanParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPlan(p: typeof plansTable.$inferSelect) {
  return {
    ...p,
    price: parseFloat(String(p.price)),
    createdAt: p.createdAt.toISOString(),
  };
}

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

router.get("/plans", requireAuth, async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.price);
  res.json(ListPlansResponse.parse(plans.map(formatPlan)));
});

router.post("/plans", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [plan] = await db.insert(plansTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
  }).returning();
  res.status(201).json(GetPlanResponse.parse(formatPlan(plan)));
});

router.get("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(GetPlanResponse.parse(formatPlan(plan)));
});

router.patch("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdatePlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { price: priceNum, ...restData } = parsed.data;
  type PlanUpdateFields = Partial<Omit<typeof plansTable.$inferInsert, 'id' | 'createdAt'>>;
  const updateData: PlanUpdateFields = { ...restData };
  if (priceNum != null) (updateData as { price?: string }).price = String(priceNum);
  const [plan] = await db.update(plansTable).set(updateData).where(eq(plansTable.id, id)).returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(UpdatePlanResponse.parse(formatPlan(plan)));
});

router.delete("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeletePlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [plan] = await db.delete(plansTable).where(eq(plansTable.id, id)).returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.sendStatus(204);
});

export default router;
