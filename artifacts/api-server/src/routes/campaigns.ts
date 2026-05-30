import { Router } from "express";
import type { IRouter } from "express";
import { db, campaignsTable, clientsTable, keywordsTable, activityLogTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListCampaignsQueryParams,
  ListCampaignsResponse,
  CreateCampaignBody,
  GetCampaignParams,
  GetCampaignResponse,
  UpdateCampaignParams,
  UpdateCampaignBody,
  UpdateCampaignResponse,
  DeleteCampaignParams,
  GetCampaignKeywordsParams,
  GetCampaignKeywordsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

async function formatCampaign(c: typeof campaignsTable.$inferSelect) {
  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, c.clientId));
  const [kCount] = await db.select({ count: count() }).from(keywordsTable).where(eq(keywordsTable.campaignId, c.id));
  return {
    ...c,
    clientName: clientRow?.name ?? null,
    keywordCount: kCount.count,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const params = ListCampaignsQueryParams.safeParse(req.query);
  const clientId = params.success ? params.data.clientId : undefined;
  const status = params.success ? params.data.status : undefined;

  let query = db.select().from(campaignsTable).$dynamic();
  if (clientId) query = query.where(eq(campaignsTable.clientId, clientId));
  if (status) query = query.where(eq(campaignsTable.status, status));
  const campaigns = await query.orderBy(sql`${campaignsTable.createdAt} DESC`);

  res.json(ListCampaignsResponse.parse(await Promise.all(campaigns.map(formatCampaign))));
});

router.post("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [campaign] = await db.insert(campaignsTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "active",
  }).returning();

  await db.insert(activityLogTable).values({
    type: "campaign_created",
    description: `Campaign "${campaign.name}" created`,
    entityId: campaign.id,
  });

  res.status(201).json(GetCampaignResponse.parse(await formatCampaign(campaign)));
});

router.get("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(GetCampaignResponse.parse(await formatCampaign(campaign)));
});

router.patch("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [campaign] = await db.update(campaignsTable).set(parsed.data).where(eq(campaignsTable.id, id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(UpdateCampaignResponse.parse(await formatCampaign(campaign)));
});

router.delete("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [campaign] = await db.delete(campaignsTable).where(eq(campaignsTable.id, id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.sendStatus(204);
});

router.get("/campaigns/:id/keywords", requireAuth, async (req, res): Promise<void> => {
  const params = GetCampaignKeywordsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  const [clientRow] = campaign ? await db.select().from(clientsTable).where(eq(clientsTable.id, campaign.clientId)) : [null];
  const keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.campaignId, id));

  res.json(GetCampaignKeywordsResponse.parse(
    keywords.map(k => ({
      ...k,
      campaignName: campaign?.name ?? null,
      clientName: clientRow?.name ?? null,
      rankChange: k.previousRank != null && k.currentRank != null ? k.previousRank - k.currentRank : null,
      lastUpdated: k.lastUpdated.toISOString(),
    }))
  ));
});

export default router;
