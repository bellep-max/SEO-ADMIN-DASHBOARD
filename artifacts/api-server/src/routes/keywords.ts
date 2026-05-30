import { Router } from "express";
import type { IRouter } from "express";
import { db, keywordsTable, keywordRankHistoryTable, campaignsTable, clientsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListKeywordsQueryParams,
  ListKeywordsResponse,
  CreateKeywordBody,
  BulkCreateKeywordsBody,
  GetKeywordParams,
  GetKeywordResponse,
  UpdateKeywordParams,
  UpdateKeywordBody,
  UpdateKeywordResponse,
  DeleteKeywordParams,
  GetKeywordHistoryParams,
  GetKeywordHistoryResponse,
  RefreshKeywordRankParams,
  RefreshKeywordRankResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

async function formatKeyword(k: typeof keywordsTable.$inferSelect) {
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, k.campaignId));
  let clientName: string | null = null;
  if (campaign) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, campaign.clientId));
    clientName = client?.name ?? null;
  }
  return {
    ...k,
    campaignName: campaign?.name ?? null,
    clientName,
    rankChange: k.previousRank != null && k.currentRank != null ? k.previousRank - k.currentRank : null,
    lastUpdated: k.lastUpdated.toISOString(),
  };
}

router.get("/keywords", requireAuth, async (req, res): Promise<void> => {
  const params = ListKeywordsQueryParams.safeParse(req.query);
  const campaignId = params.success ? params.data.campaignId : undefined;

  let query = db.select().from(keywordsTable).$dynamic();
  if (campaignId) query = query.where(eq(keywordsTable.campaignId, campaignId));
  const keywords = await query.orderBy(sql`${keywordsTable.lastUpdated} DESC`);

  res.json(ListKeywordsResponse.parse(await Promise.all(keywords.map(formatKeyword))));
});

router.post("/keywords", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateKeywordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [keyword] = await db.insert(keywordsTable).values(parsed.data).returning();
  if (keyword.currentRank != null) {
    await db.insert(keywordRankHistoryTable).values({ keywordId: keyword.id, rank: keyword.currentRank });
  }
  res.status(201).json(GetKeywordResponse.parse(await formatKeyword(keyword)));
});

router.post("/keywords/bulk", requireAuth, async (req, res): Promise<void> => {
  const parsed = BulkCreateKeywordsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { campaignId, keywords } = parsed.data;
  const inserted = await db.insert(keywordsTable).values(
    keywords.map((kw: string) => ({ campaignId, keywordText: kw }))
  ).returning();
  const formatted = await Promise.all(inserted.map(formatKeyword));
  res.status(201).json(formatted);
});

router.get("/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetKeywordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [keyword] = await db.select().from(keywordsTable).where(eq(keywordsTable.id, id));
  if (!keyword) { res.status(404).json({ error: "Keyword not found" }); return; }
  res.json(GetKeywordResponse.parse(await formatKeyword(keyword)));
});

router.patch("/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateKeywordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const parsed = UpdateKeywordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [keyword] = await db.update(keywordsTable).set(parsed.data).where(eq(keywordsTable.id, id)).returning();
  if (!keyword) { res.status(404).json({ error: "Keyword not found" }); return; }
  res.json(UpdateKeywordResponse.parse(await formatKeyword(keyword)));
});

router.delete("/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteKeywordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [keyword] = await db.delete(keywordsTable).where(eq(keywordsTable.id, id)).returning();
  if (!keyword) { res.status(404).json({ error: "Keyword not found" }); return; }
  res.sendStatus(204);
});

router.get("/keywords/:id/history", requireAuth, async (req, res): Promise<void> => {
  const params = GetKeywordHistoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const history = await db
    .select()
    .from(keywordRankHistoryTable)
    .where(eq(keywordRankHistoryTable.keywordId, id))
    .orderBy(keywordRankHistoryTable.recordedAt);

  res.json(GetKeywordHistoryResponse.parse(
    history.map(h => ({ date: h.recordedAt.toISOString(), rank: h.rank }))
  ));
});

router.post("/keywords/:id/refresh", requireAuth, async (req, res): Promise<void> => {
  const params = RefreshKeywordRankParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [existing] = await db.select().from(keywordsTable).where(eq(keywordsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Keyword not found" }); return; }

  // Simulate rank change: random shift of -5 to +5
  const currentRank = existing.currentRank ?? Math.floor(Math.random() * 50) + 1;
  const shift = Math.floor(Math.random() * 11) - 5;
  const newRank = Math.max(1, currentRank + shift);

  const [updated] = await db.update(keywordsTable).set({
    previousRank: existing.currentRank,
    currentRank: newRank,
    lastUpdated: new Date(),
  }).where(eq(keywordsTable.id, id)).returning();

  await db.insert(keywordRankHistoryTable).values({ keywordId: id, rank: newRank });

  res.json(RefreshKeywordRankResponse.parse(await formatKeyword(updated)));
});

export default router;
