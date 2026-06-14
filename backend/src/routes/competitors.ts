import { Router } from "express";
import type { IRouter } from "express";
import { db, competitorsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListCompetitorsQueryParams,
  ListCompetitorsResponse,
  CreateCompetitorBody,
  DeleteCompetitorParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

router.get("/competitors", requireAuth, async (req, res): Promise<void> => {
  const params = ListCompetitorsQueryParams.safeParse(req.query);
  const clientId = params.success ? params.data.clientId : undefined;

  let query = db.select().from(competitorsTable).$dynamic();
  if (clientId) query = query.where(eq(competitorsTable.clientId, clientId));
  const competitors = await query.orderBy(sql`${competitorsTable.createdAt} DESC`);

  res.json(ListCompetitorsResponse.parse(
    competitors.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))
  ));
});

router.post("/competitors", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCompetitorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [competitor] = await db.insert(competitorsTable).values(parsed.data).returning();
  res.status(201).json({ ...competitor, createdAt: competitor.createdAt.toISOString() });
});

router.delete("/competitors/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCompetitorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [comp] = await db.delete(competitorsTable).where(eq(competitorsTable.id, id)).returning();
  if (!comp) { res.status(404).json({ error: "Competitor not found" }); return; }
  res.sendStatus(204);
});

export default router;
