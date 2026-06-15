# Handover: real geo-grid heatmaps + keyword ranks (replace the mock data)

**For:** the Claude Code / engineer working in this repo (SEO-ADMIN-DASHBOARD).
**Goal:** the admin can generate and view a **real** local-rank **heat map** per client
(LocalFalcon-style geo-grid) and real keyword ranks — replacing the demo/random data that's
wired today. This document is self-contained: what to do, where to look, the data model, the
reference implementation, and the decisions already made.

## TL;DR
The dashboard is **already fully scaffolded** for this (DB tables, routes, grid math, frontend).
It just fills the data with **fake numbers**. Your job is to swap the fake number generator for a
**real SERP rank lookup** (Serper.dev), keeping everything else. **Do NOT deploy the separate
`seo-keyword-research` service** — port the thin rank-lookup logic into THIS Node/Express backend
so the dashboard is self-contained.

There is **no LocalFalcon API** and we are not buying one. "LocalFalcon-style" = our own geo-grid.

## What's mocked today (the exact swap points)
1. **Heat map** — `backend/src/routes/geo-grids.ts`, `POST /geo-grids/:id/generate`.
   Line ~127 calls **`simulateRank(p.row, p.col, cfg.gridSize)`** (random demo numbers) to fill
   `geo_grid_results`. **Replace that one call** with a real rank for each grid point.
2. **Keyword rank** — `backend/src/routes/keywords.ts`, `POST /keywords/:id/refresh`.
   Uses `Math.random()` to shift the rank. **Replace** with a real SERP rank for the keyword at
   the client's location, then write `keyword_rank_history` (already done) with the real number.

Everything else around these is real and stays: grid-point math (`generateGridPoints`), storage,
the GET routes that serve configs+results, and the frontend that renders the map.

## Data model (already exists — do not recreate)
`database/src/schema/geo_grid.ts`:
- **`geo_grid_configs`**: `id, clientId, campaignId?, businessId?, keyword, centerAddress?,
  centerLat, centerLng, radiusMiles(=5), gridSize(=5), createdAt, lastGeneratedAt` — one heatmap
  definition.
- **`geo_grid_results`**: `id, configId, gridRow, gridCol, lat, lng, rank, generatedAt` — one row
  per grid cell; **`rank` is the heatmap value**.

`database/src/schema/keywords.ts`: `keywords` (has `currentRank`, `previousRank`) +
`keyword_rank_history` (`keywordId, rank, recordedAt`).

## The rank source: Serper.dev SERP API (captcha-free, no phones)
The reference implementation lives in the **device-agent** repo (do not import it — port it):
- `~/projects/device-agent/serp_api_source.py` — provider-agnostic SERP API client.
  - Default provider **Serper.dev** (`SERP_PROVIDER=serper`, key `SERP_API_KEY`). One POST to
    `https://google.serper.dev/search` with `{q, location, gl:"us", hl:"en", num:20}` → structured
    JSON (organic + local pack). Captcha-free; no proxy/phone needed.
  - `_rank(serp, domain)` → `(organic_rank, local_rank)` for the target domain by matching the
    result host (strip scheme/`www`).
- `~/projects/device-agent/geo_grid.py` — the LocalFalcon-style grid. `measure_grid(business,
  domain, keyword, points)` loops grid points, calls `fetch_serpapi(keyword, location)` + `_rank`,
  and takes **`rank = local_rank or organic_rank`** (the **local/map-pack rank wins for "near me"**
  queries; fall back to organic). `_color()` shows the convention: **≤3 green, ≤10 blue, 11–20
  amber, none = 21+ grey.**
- A generated example to eyeball the output shape:
  `~/projects/device-agent/geo_grid_results/mae-s-childcare_childcare-near-me.{html,json}`.

**Port `_fetch_serper` + `_rank` into a small TS module** (e.g. `backend/src/lib/serp.ts`):
```
serpRank(keyword: string, opts: { location?: string; lat?: number; lng?: number },
         domain: string): Promise<{ organic: number|null; local: number|null }>
```
Serper accepts a Google `location` **string** (e.g. "San Francisco, California, United States")
*or* a lat/lng (`ll`). The dashboard grid currently produces only **lat/lng** (no location string),
so either pass lat/lng to Serper, or reverse-geocode the center once and reuse the city string for
all cells (cheaper, slightly less precise). Match `geo_grid.py`'s "local-pack-wins" rule.

## What to build (concrete steps)
1. **`backend/src/lib/serp.ts`** — port `_fetch_serper` (the HTTP call) + `_rank` (domain → organic
   & local rank). Read `SERP_API_KEY` from env; provider switch optional.
2. **Heatmap** — in `POST /geo-grids/:id/generate`, replace `simulateRank(...)` with
   `await serpRank(cfg.keyword, { lat: p.lat, lng: p.lng }, <client domain>)` per point, store
   `local ?? organic` as `rank`. Keep the clear-then-insert + `lastGeneratedAt` update. The client's
   domain comes from the linked business/client row (`cfg.businessId` → `businesses.website`).
3. **Keyword refresh** — in `POST /keywords/:id/refresh`, replace the random shift with a single
   `serpRank(keyword.text, { location: <client city> }, <client domain>)`; write `currentRank`,
   `previousRank`, and a `keyword_rank_history` row (history insert already exists).
4. **Env** — add to the backend env (Replit secrets + a `.env.example`):
   `SERP_API_KEY=...` (Serper.dev), `SERP_PROVIDER=serper`. (Optional, only if you also wire keyword
   *ideas*: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`.) No SERP/DeepSeek key exists in the backend today.
5. **Frontend** — should need no change if it already renders `geo_grid_results`; verify the color
   thresholds match (≤3 / ≤10 / ≤20 / none).

## Decisions already made
- **On-demand generation.** Admin clicks "Generate" → the endpoint runs the live scan and returns
  results. A 5×5 grid = **25 Serper calls** (~5–20s). Cache via `lastGeneratedAt`; offer a "refresh"
  rather than auto-running. (A nightly batch per client can come later — same code, a cron caller.)
- **Self-contained** — port into this backend; do **not** stand up the `seo-keyword-research`
  FastAPI service. (That service exists and does the same job, but it expects an external per-point
  scanner — the phone fleet — and adds a second runtime. Out of scope here.)
- **google_local surface only** for v1 — the Serper path measures the Google local/organic rank
  (the LocalFalcon use case). AI-engine heatmaps (chatgpt/gemini/perplexity "Share of Local Voice")
  need the phone fleet and are a later phase, not this handover.

## Cost & perf
- Each grid **cell = 1 Serper call**; each keyword refresh = 1 call. 5×5 grid × keywords × clients
  adds up — Serper has a free tier then per-call pricing. Gate generation behind the button + cache;
  don't auto-regenerate on page load.
- Keep `gridSize` small by default (5×5 = 25). `radiusMiles` controls spread (grid math already there).

## Out of scope / later
- **Measured keyword difficulty** and **AI-surface (chatgpt/gemini/perplexity) heatmaps** — these
  need the phone fleet (the `device-agent` app + runners), not a SERP API. Leave hooks, don't build.
- The richer `seo-keyword-research` pipeline (SoLV, query-gen, daily runs) — only revisit if you
  later decide to deploy that service instead of the self-contained port.

## Where everything lives
| Thing | Path / repo |
|---|---|
| This dashboard | `~/projects/SEO-ADMIN-DASHBOARD` — `bellep-max/SEO-ADMIN-DASHBOARD` @ `main` |
| Heatmap swap point | `backend/src/routes/geo-grids.ts` (`/geo-grids/:id/generate`, `simulateRank`) |
| Keyword swap point | `backend/src/routes/keywords.ts` (`/keywords/:id/refresh`) |
| DB schema | `database/src/schema/geo_grid.ts`, `keywords.ts` (Drizzle) |
| Rank-source reference | `~/projects/device-agent/serp_api_source.py`, `geo_grid.py` |
| Keyword-research reference | `~/projects/device-agent/keyword_research.py` + `LOCAL_KEYWORD_RESEARCH.md` |
| Example heatmap output | `~/projects/device-agent/geo_grid_results/mae-s-childcare_childcare-near-me.html` |
| (NOT deploying) full service | `~/projects/seo-keyword-research` (FastAPI; reference only) |

## Definition of done
- Admin creates a geo-grid config for a client, clicks **Generate**, and sees a heatmap whose cell
  ranks come from **real Serper results** (verify a known business ranks green near its location and
  fades with distance — not random).
- A keyword **refresh** updates `currentRank` + `keyword_rank_history` with a real SERP rank.
- `SERP_API_KEY` is set in the deploy env; no `simulateRank`/`Math.random()` rank left in the served
  paths.
