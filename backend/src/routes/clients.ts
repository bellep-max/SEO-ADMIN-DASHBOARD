import { Router } from "express";
import type { IRouter } from "express";
import { db, clientsTable, campaignsTable, keywordsTable, backlinksTable, businessesTable, plansTable, activityLogTable } from "@workspace/db";
import { eq, ilike, or, sql, count, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListClientsQueryParams,
  ListClientsResponse,
  CreateClientBody,
  GetClientParams,
  GetClientResponse,
  UpdateClientParams,
  UpdateClientBody,
  UpdateClientResponse,
  DeleteClientParams,
  GetClientCampaignsParams,
  GetClientCampaignsResponse,
  GetClientKeywordsParams,
  GetClientKeywordsResponse,
  GetClientBacklinksParams,
  GetClientBacklinksResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

async function formatClient(client: typeof clientsTable.$inferSelect) {
  let planName: string | null = null;
  if (client.assignedPlanId) {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, client.assignedPlanId));
    planName = plan?.name ?? null;
  }
  const [bizCount] = await db.select({ count: count() }).from(businessesTable).where(eq(businessesTable.clientId, client.id));
  const [campCount] = await db.select({ count: count() }).from(campaignsTable).where(eq(campaignsTable.clientId, client.id));
  return {
    ...client,
    price: undefined,
    planName,
    businessCount: bizCount?.count ?? 0,
    campaignCount: campCount?.count ?? 0,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const params = ListClientsQueryParams.safeParse(req.query);
  const search = params.success ? params.data.search : undefined;
  const status = params.success ? params.data.status : undefined;
  const type = params.success ? params.data.type : undefined;
  const plan = params.success ? params.data.plan : undefined;
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) conditions.push(or(ilike(clientsTable.name, `%${search}%`), ilike(clientsTable.email, `%${search}%`)));
  if (status) conditions.push(eq(clientsTable.status, status));
  if (type) conditions.push(eq(clientsTable.accountType, type));
  if (plan) {
    const [planRow] = await db.select({ id: plansTable.id }).from(plansTable).where(ilike(plansTable.name, plan));
    if (planRow) conditions.push(eq(clientsTable.assignedPlanId, planRow.id));
    else conditions.push(sql`1=0`);
  }
  const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(clientsTable)
    .where(whereClause);

  const clients = await db
    .select()
    .from(clientsTable)
    .where(whereClause)
    .orderBy(sql`${clientsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const formatted = await Promise.all(clients.map(formatClient));

  res.json(ListClientsResponse.parse({
    clients: formatted,
    total: totalResult.count,
    page,
    limit,
  }));
});

router.post("/clients", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "active",
  }).returning();

  await db.insert(activityLogTable).values({
    type: "client_created",
    description: `New client added: ${client.name}`,
    entityId: client.id,
  });

  res.status(201).json(GetClientResponse.parse(await formatClient(client)));
});

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(GetClientResponse.parse(await formatClient(client)));
});

router.patch("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.update(clientsTable).set(parsed.data).where(eq(clientsTable.id, id)).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  res.json(UpdateClientResponse.parse(await formatClient(client)));
});

router.delete("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);

  const [existing] = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Client not found" }); return; }

  const campaigns = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(eq(campaignsTable.clientId, id));
  for (const c of campaigns) {
    await db.delete(keywordsTable).where(eq(keywordsTable.campaignId, c.id));
  }
  await db.delete(campaignsTable).where(eq(campaignsTable.clientId, id));
  await db.delete(backlinksTable).where(eq(backlinksTable.clientId, id));
  await db.delete(businessesTable).where(eq(businessesTable.clientId, id));
  await db.delete(clientsTable).where(eq(clientsTable.id, id));

  res.sendStatus(204);
});

router.get("/clients/:id/campaigns", requireAuth, async (req, res): Promise<void> => {
  const params = GetClientCampaignsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.clientId, id));
  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));

  const keywordCounts = await db
    .select({ campaignId: keywordsTable.campaignId, count: count() })
    .from(keywordsTable)
    .groupBy(keywordsTable.campaignId);
  const countMap = new Map(keywordCounts.map(k => [k.campaignId, k.count]));

  res.json(GetClientCampaignsResponse.parse(
    campaigns.map(c => ({
      ...c,
      clientName: clientRow?.name ?? null,
      keywordCount: countMap.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    }))
  ));
});

router.get("/clients/:id/keywords", requireAuth, async (req, res): Promise<void> => {
  const params = GetClientKeywordsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.clientId, id));
  const campaignIds = campaigns.map(c => c.id);
  if (campaignIds.length === 0) { res.json([]); return; }

  const keywords = await db.select().from(keywordsTable).where(
    inArray(keywordsTable.campaignId, campaignIds)
  );
  const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));

  res.json(GetClientKeywordsResponse.parse(
    keywords.map(k => ({
      ...k,
      campaignName: campaignMap.get(k.campaignId) ?? null,
      clientName: clientRow?.name ?? null,
      rankChange: k.previousRank != null && k.currentRank != null ? k.previousRank - k.currentRank : null,
      lastUpdated: k.lastUpdated.toISOString(),
    }))
  ));
});

router.get("/clients/:id/backlinks", requireAuth, async (req, res): Promise<void> => {
  const params = GetClientBacklinksParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  const backlinks = await db.select().from(backlinksTable).where(eq(backlinksTable.clientId, id));
  res.json(GetClientBacklinksResponse.parse(
    backlinks.map(b => ({
      ...b,
      clientName: clientRow?.name ?? null,
      firstDetected: b.firstDetected.toISOString(),
      lastSeen: b.lastSeen?.toISOString() ?? null,
    }))
  ));
});

export default router;
