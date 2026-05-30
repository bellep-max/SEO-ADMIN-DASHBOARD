import { Router } from "express";
import type { IRouter } from "express";
import { db, reportsTable, clientsTable, campaignsTable, keywordsTable, backlinksTable } from "@workspace/db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListReportsQueryParams,
  ListReportsResponse,
  CreateReportBody,
  GetReportParams,
  GetReportResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

async function formatReport(r: typeof reportsTable.$inferSelect) {
  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, r.clientId));
  const [campaignRow] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, r.campaignId));
  return {
    ...r,
    clientName: clientRow?.name ?? null,
    campaignName: campaignRow?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reports", requireAuth, async (req, res): Promise<void> => {
  const params = ListReportsQueryParams.safeParse(req.query);
  const clientId = params.success ? params.data.clientId : undefined;

  let query = db.select().from(reportsTable).$dynamic();
  if (clientId) query = query.where(eq(reportsTable.clientId, clientId));
  const reports = await query.orderBy(sql`${reportsTable.createdAt} DESC`);

  res.json(ListReportsResponse.parse(await Promise.all(reports.map(formatReport))));
});

router.post("/reports", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { clientId, campaignId } = parsed.data;

  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  const [campaignRow] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  const keywords = await db.select().from(keywordsTable)
    .where(eq(keywordsTable.campaignId, campaignId))
    .orderBy(keywordsTable.currentRank)
    .limit(10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newBacklinks = await db.select().from(backlinksTable)
    .where(and(eq(backlinksTable.clientId, clientId), gte(backlinksTable.firstDetected, thirtyDaysAgo)))
    .limit(10);

  const summary = `SEO Report for ${clientRow?.name ?? "Client"} — Campaign: ${campaignRow?.name ?? "Campaign"}\n\nTop Keywords:\n${keywords.map(k => `  - ${k.keywordText}: rank ${k.currentRank ?? "N/A"}`).join("\n")}\n\nNew Backlinks (last 30 days): ${newBacklinks.length}\n\nGenerated: ${new Date().toISOString()}`;

  const [report] = await db.insert(reportsTable).values({ clientId, campaignId, summary }).returning();
  res.status(201).json(GetReportResponse.parse(await formatReport(report)));
});

router.get("/reports/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = parseId(params.data.id);
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(GetReportResponse.parse(await formatReport(report)));
});

export default router;
