import { Router } from "express";
import type { IRouter } from "express";
import { requireAuth } from "../lib/auth";
import { lfConfigured, listReports, getReport, listLocations, runScan } from "../lib/localfalcon";

const router: IRouter = Router();

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Is the LocalFalcon integration configured? (lets the UI show a setup notice)
router.get("/falcon/status", requireAuth, (_req, res): void => {
  res.json({ configured: lfConfigured() });
});

router.get("/falcon/reports", requireAuth, async (req, res): Promise<void> => {
  if (!lfConfigured()) { res.status(503).json({ error: "LocalFalcon not configured" }); return; }
  try {
    const data = await listReports({
      keyword: str(req.query.keyword), place_id: str(req.query.place_id),
      grid_size: str(req.query.grid_size), platform: str(req.query.platform),
      limit: str(req.query.limit) ?? "12", next_token: str(req.query.next_token),
    });
    res.json(data);
  } catch (err) { res.status(502).json({ error: (err as Error).message }); }
});

router.get("/falcon/reports/:key", requireAuth, async (req, res): Promise<void> => {
  if (!lfConfigured()) { res.status(503).json({ error: "LocalFalcon not configured" }); return; }
  try {
    res.json(await getReport(String(req.params.key)));
  } catch (err) { res.status(502).json({ error: (err as Error).message }); }
});

router.get("/falcon/locations", requireAuth, async (req, res): Promise<void> => {
  if (!lfConfigured()) { res.status(503).json({ error: "LocalFalcon not configured" }); return; }
  try {
    const data = await listLocations({
      query: str(req.query.query), limit: str(req.query.limit) ?? "12", next_token: str(req.query.next_token),
    });
    res.json(data);
  } catch (err) { res.status(502).json({ error: (err as Error).message }); }
});

// Spends LocalFalcon credits — only fires on explicit user action.
router.post("/falcon/run-scan", requireAuth, async (req, res): Promise<void> => {
  if (!lfConfigured()) { res.status(503).json({ error: "LocalFalcon not configured" }); return; }
  const b = req.body ?? {};
  const required = ["place_id", "keyword", "lat", "lng", "grid_size", "radius", "measurement", "platform"];
  const missing = required.filter((k) => !str(b[k]));
  if (missing.length) { res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` }); return; }
  try {
    const data = await runScan({
      place_id: String(b.place_id), keyword: String(b.keyword), lat: String(b.lat), lng: String(b.lng),
      grid_size: String(b.grid_size), radius: String(b.radius), measurement: String(b.measurement),
      platform: String(b.platform), ai_analysis: str(b.ai_analysis),
    });
    res.json(data);
  } catch (err) {
    (req as typeof req & { log?: { error: (o: unknown, m: string) => void } }).log?.error({ err }, "falcon run-scan failed");
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
