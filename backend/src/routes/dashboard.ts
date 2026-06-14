import { Router } from "express";
import type { IRouter } from "express";
import { db, clientsTable, campaignsTable, keywordsTable, backlinksTable, activityLogTable, plansTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { sql, count, and, gte, eq } from "drizzle-orm";
import {
  GetDashboardStatsResponse,
  GetDashboardActivityResponse,
  GetDashboardRevenueResponse,
  GetKeywordAlertsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res): Promise<void> => {
  const [clientCount] = await db.select({ count: count() }).from(clientsTable);
  const [activeClientCount] = await db.select({ count: count() }).from(clientsTable).where(eq(clientsTable.status, "active"));
  const [campaignCount] = await db.select({ count: count() }).from(campaignsTable).where(eq(campaignsTable.status, "active"));
  const [keywordCount] = await db.select({ count: count() }).from(keywordsTable);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [newBacklinks] = await db.select({ count: count() }).from(backlinksTable).where(gte(backlinksTable.firstDetected, thirtyDaysAgo));

  // Calculate revenue from active clients' plans
  const revenueResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${plansTable.price}), 0)` })
    .from(clientsTable)
    .leftJoin(plansTable, eq(clientsTable.assignedPlanId, plansTable.id))
    .where(eq(clientsTable.status, "active"));

  res.json(GetDashboardStatsResponse.parse({
    totalClients: clientCount.count,
    activeClients: activeClientCount.count,
    activeCampaigns: campaignCount.count,
    totalKeywords: keywordCount.count,
    newBacklinks30d: newBacklinks.count,
    totalRevenue: parseFloat(revenueResult[0]?.total ?? "0"),
  }));
});

router.get("/dashboard/activity", requireAuth, async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(activityLogTable)
    .orderBy(sql`${activityLogTable.createdAt} DESC`)
    .limit(20);

  res.json(GetDashboardActivityResponse.parse(
    items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() }))
  ));
});

router.get("/dashboard/revenue", requireAuth, async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', gs.month), 'YYYY-MM') AS month,
      COALESCE(SUM(p.price), 0)::float AS revenue
    FROM GENERATE_SERIES(
      DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) AS gs(month)
    LEFT JOIN clients c ON c.status = 'active' AND DATE_TRUNC('month', c.created_at) <= gs.month
    LEFT JOIN plans p ON p.id = c.assigned_plan_id
    GROUP BY gs.month
    ORDER BY gs.month
  `);

  res.json(GetDashboardRevenueResponse.parse(
    (result.rows as Array<{ month: string; revenue: number }>).map(r => ({
      month: r.month,
      revenue: Number(r.revenue),
    }))
  ));
});

router.get("/dashboard/keyword-alerts", requireAuth, async (_req, res): Promise<void> => {
  const alerts = await db.execute(sql`
    SELECT
      k.id AS "keywordId",
      k.keyword_text AS "keywordText",
      cam.name AS "campaignName",
      c.name AS "clientName",
      k.previous_rank AS "previousRank",
      k.current_rank AS "currentRank",
      (k.current_rank - k.previous_rank) AS drop
    FROM keywords k
    JOIN campaigns cam ON cam.id = k.campaign_id
    JOIN clients c ON c.id = cam.client_id
    WHERE k.previous_rank IS NOT NULL
      AND k.current_rank IS NOT NULL
      AND (k.current_rank - k.previous_rank) > 10
    ORDER BY (k.current_rank - k.previous_rank) DESC
    LIMIT 20
  `);

  res.json(GetKeywordAlertsResponse.parse(alerts.rows));
});

export default router;
