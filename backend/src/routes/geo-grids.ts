import { Router } from "express";
import type { IRouter } from "express";
import { db, geoGridConfigsTable, geoGridResultsTable, campaignsTable, businessesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
const router: IRouter = Router();

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

// Simulate a rank for a given distance from center (for demo use)
function simulateRank(row: number, col: number, gridSize: number): number {
  const centerRow = (gridSize - 1) / 2;
  const centerCol = (gridSize - 1) / 2;
  const dist = Math.sqrt((row - centerRow) ** 2 + (col - centerCol) ** 2);
  const maxDist = Math.sqrt(2) * centerRow;
  const normalizedDist = dist / maxDist;
  const baseRank = Math.round(1 + normalizedDist * 28);
  const jitter = Math.floor(Math.random() * 6) - 3;
  return Math.max(1, Math.min(30, baseRank + jitter));
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

// POST /geo-grids/:id/generate  — simulate rank scan
router.post("/geo-grids/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [cfg] = await db.select().from(geoGridConfigsTable).where(eq(geoGridConfigsTable.id, id));
  if (!cfg) { res.status(404).json({ error: "Grid config not found" }); return; }

  const points = generateGridPoints(cfg.centerLat, cfg.centerLng, cfg.radiusMiles, cfg.gridSize);

  // Clear old results for this config
  await db.delete(geoGridResultsTable).where(eq(geoGridResultsTable.configId, id));

  // Insert new simulated results
  const now = new Date();
  await db.insert(geoGridResultsTable).values(
    points.map(p => ({
      configId: id,
      gridRow: p.row,
      gridCol: p.col,
      lat: p.lat,
      lng: p.lng,
      rank: simulateRank(p.row, p.col, cfg.gridSize),
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
