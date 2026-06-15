import { Router } from "express";
import type { IRouter } from "express";
import { db, geoGridConfigsTable, geoGridResultsTable, campaignsTable, businessesTable, clientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { serpRank, serpConfigured } from "../lib/serp";
const router: IRouter = Router();

// Run `fn` over items with bounded concurrency (keeps a 5x5 grid = 25 Serper
// calls fast without hammering the API). Results stay index-aligned with input.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

// Generate grid point coordinates from center + radius + grid size
function generateGridPoints(centerLat: number, centerLng: number, radiusMiles: number, gridSize: number) {
  const points: { row: number; col: number; lat: number; lng: number }[] = [];
  const latStep = (2 * radiusMiles) / (gridSize - 1) / 69.0;
  const lngStep = (2 * radiusMiles) / (gridSize - 1) / (69.0 * Math.cos((centerLat * Math.PI) / 180));
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = centerLat + ((gridSize - 1) / 2 - row) * latStep;
      const lng = centerLng + (col - (gridSize - 1) / 2) * lngStep;
      points.push({ row, col, lat, lng });
    }
  }
  return points;
}

// Resolve the target domain for a config: the linked business's website wins,
// else the client's website. Returns null when neither is set.
async function resolveDomain(cfg: typeof geoGridConfigsTable.$inferSelect): Promise<string | null> {
  if (cfg.businessId) {
    const [b] = await db.select({ website: businessesTable.website }).from(businessesTable).where(eq(businessesTable.id, cfg.businessId));
    if (b?.website) return b.website;
  }
  const [c] = await db.select({ websiteUrl: clientsTable.websiteUrl }).from(clientsTable).where(eq(clientsTable.id, cfg.clientId));
  return c?.websiteUrl ?? null;
}

async function formatConfig(cfg: typeof geoGridConfigsTable.$inferSelect) {
  let campaignName: string | null = null;
  let businessName: string | null = null;
  if (cfg.campaignId) {
    const [c] = await db.select({ name: campaignsTable.name }).from(campaignsTable).where(eq(campaignsTable.id, cfg.campaignId));
    campaignName = c?.name ?? null;
  }
  if (cfg.businessId) {
    const [b] = await db.select({ name: businessesTable.businessName }).from(businessesTable).where(eq(businessesTable.id, cfg.businessId));
    businessName = b?.name ?? null;
  }
  return {
    ...cfg,
    createdAt: cfg.createdAt.toISOString(),
    lastGeneratedAt: cfg.lastGeneratedAt?.toISOString() ?? null,
    campaignName,
    businessName,
  };
}

// GET /geo-grids?clientId=X
router.get("/geo-grids", requireAuth, async (req, res): Promise<void> => {
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
  if (!clientId) { res.status(400).json({ error: "clientId required" }); return; }
  const configs = await db.select().from(geoGridConfigsTable).where(eq(geoGridConfigsTable.clientId, clientId));
  const formatted = await Promise.all(configs.map(formatConfig));
  res.json(formatted);
});

// POST /geo-grids
router.post("/geo-grids", requireAuth, async (req, res): Promise<void> => {
  const { clientId, campaignId, businessId, keyword, centerAddress, centerLat, centerLng, radiusMiles, gridSize } = req.body;
  if (!clientId || !keyword || centerLat == null || centerLng == null) {
    res.status(400).json({ error: "clientId, keyword, centerLat, centerLng are required" });
    return;
  }
  const [cfg] = await db.insert(geoGridConfigsTable).values({
    clientId: Number(clientId),
    campaignId: campaignId ? Number(campaignId) : null,
    businessId: businessId ? Number(businessId) : null,
    keyword: String(keyword),
    centerAddress: centerAddress ?? null,
    centerLat: Number(centerLat),
    centerLng: Number(centerLng),
    radiusMiles: radiusMiles ? Number(radiusMiles) : 5,
    gridSize: gridSize ? Number(gridSize) : 5,
  }).returning();
  res.status(201).json(await formatConfig(cfg));
});

// DELETE /geo-grids/:id
router.delete("/geo-grids/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(geoGridResultsTable).where(eq(geoGridResultsTable.configId, id));
  await db.delete(geoGridConfigsTable).where(eq(geoGridConfigsTable.id, id));
  res.sendStatus(204);
});

// GET /geo-grids/:id/results
router.get("/geo-grids/:id/results", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const results = await db.select().from(geoGridResultsTable)
    .where(eq(geoGridResultsTable.configId, id))
    .orderBy(geoGridResultsTable.gridRow, geoGridResultsTable.gridCol);
  res.json(results.map(r => ({ ...r, generatedAt: r.generatedAt.toISOString() })));
});

// POST /geo-grids/:id/generate  — run a live SERP rank scan across the grid
router.post("/geo-grids/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [cfg] = await db.select().from(geoGridConfigsTable).where(eq(geoGridConfigsTable.id, id));
  if (!cfg) { res.status(404).json({ error: "Grid config not found" }); return; }

  if (!serpConfigured()) {
    res.status(503).json({ error: "Rank measurement is not configured (SERP_API_KEY missing)." });
    return;
  }
  const domain = await resolveDomain(cfg);
  if (!domain) {
    res.status(400).json({ error: "No website set for this client/business — add a website to measure ranks." });
    return;
  }

  const points = generateGridPoints(cfg.centerLat, cfg.centerLng, cfg.radiusMiles, cfg.gridSize);

  // Measure a real SERP rank for each grid point (its own lat/lng drives the
  // local-pack proximity ranking). Local/map-pack rank wins for "near me"
  // queries; fall back to organic; null when the target isn't found at all.
  const ranks = await mapPool(points, 5, async (p): Promise<number | null> => {
    try {
      const { organic, local } = await serpRank(cfg.keyword, { lat: p.lat, lng: p.lng }, domain);
      return local ?? organic;
    } catch (err) {
      (req as typeof req & { log?: { warn: (o: unknown, m: string) => void } }).log?.warn(
        { err, lat: p.lat, lng: p.lng }, "serp rank failed for grid point",
      );
      return null;
    }
  });

  // Clear old results for this config
  await db.delete(geoGridResultsTable).where(eq(geoGridResultsTable.configId, id));

  // Insert the freshly measured results
  const now = new Date();
  await db.insert(geoGridResultsTable).values(
    points.map((p, idx) => ({
      configId: id,
      gridRow: p.row,
      gridCol: p.col,
      lat: p.lat,
      lng: p.lng,
      rank: ranks[idx],
      generatedAt: now,
    }))
  );

  // Update lastGeneratedAt
  await db.update(geoGridConfigsTable).set({ lastGeneratedAt: now }).where(eq(geoGridConfigsTable.id, id));

  const results = await db.select().from(geoGridResultsTable)
    .where(eq(geoGridResultsTable.configId, id))
    .orderBy(geoGridResultsTable.gridRow, geoGridResultsTable.gridCol);

  res.json(results.map(r => ({ ...r, generatedAt: r.generatedAt.toISOString() })));
});

export default router;
