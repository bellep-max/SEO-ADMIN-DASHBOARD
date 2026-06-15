/**
 * Serper.dev SERP rank lookup — TS port of device-agent/serp_api_source.py
 * (the `_fetch_serper` + `_rank` path). Captcha-free, no phones: one POST to
 * https://google.serper.dev/search returns structured organic + local-pack JSON,
 * and we resolve the target's organic & local rank from it.
 *
 * Reads SERP_API_KEY (required) and SERP_PROVIDER (default "serper").
 *
 * Used by:
 *  - POST /geo-grids/:id/generate — one call per grid point (pass lat/lng).
 *  - POST /keywords/:id/refresh   — one call at the client's city (pass location).
 */

const SERP_ENDPOINT = "https://google.serper.dev/search";
const SERP_MAPS_ENDPOINT = "https://google.serper.dev/maps";
const DEFAULT_PROVIDER = process.env.SERP_PROVIDER ?? "serper";

export interface SerpRank {
  /** 1-based organic position of the target domain, or null if not found. */
  organic: number | null;
  /** 1-based local/map-pack position of the target, or null if not found. */
  local: number | null;
}

export interface SerpLocation {
  /** Google canonical location string, e.g. "Austin, Texas". */
  location?: string;
  /** Latitude of the measurement point (used as Serper `ll`). */
  lat?: number;
  /** Longitude of the measurement point (used as Serper `ll`). */
  lng?: number;
}

/** Registrable-ish host: lowercase, strip scheme/www/path. "" if unparseable. */
function host(url: string): string {
  try {
    const net = new URL(url.includes("://") ? url : `http://${url}`).hostname.toLowerCase();
    return net.startsWith("www.") ? net.slice(4) : net;
  } catch {
    return "";
  }
}

/**
 * Serper wants a canonical Google location. Append the country if the caller
 * passed just "City, State" (our client configs do).
 */
function normLocation(location: string): string {
  const loc = (location ?? "").trim();
  if (loc && !/united states|usa/i.test(loc)) return `${loc}, United States`;
  return loc;
}

/** Raw Serper response (only the fields we use). */
interface SerperResponse {
  organic?: Array<{ position?: number; link?: string }>;
  places?: Array<{ position?: number; title?: string }>;
  credits?: number;
}

/** POST a body to a Serper endpoint and parse JSON. Mirrors `_fetch_serper`. */
async function postSerper(
  endpoint: string,
  body: Record<string, unknown>,
  apiKey: string,
  timeoutMs = 30_000,
): Promise<SerperResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`Serper HTTP ${res.status}: ${detail}`);
    }
    return (await res.json()) as SerperResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Local/map-pack lookup via Serper /maps using the point's coordinates. This is
 * the proximity-ranked surface (the LocalFalcon use case) — results genuinely
 * change with location, which is what makes the heatmap fade with distance.
 * (Serper's /search endpoint does NOT return a local pack, so the grid uses /maps.)
 */
function fetchSerperMaps(keyword: string, lat: number, lng: number, apiKey: string, timeoutMs?: number) {
  return postSerper(SERP_MAPS_ENDPOINT, { q: keyword, ll: `@${lat},${lng},14z`, gl: "us", hl: "en" }, apiKey, timeoutMs);
}

/** Organic lookup via Serper /search at a Google location string. */
function fetchSerperSearch(keyword: string, location: string | undefined, apiKey: string, num = 20, timeoutMs?: number) {
  const body: Record<string, unknown> = { q: keyword, gl: "us", hl: "en", num };
  if (location) body.location = normLocation(location);
  return postSerper(SERP_ENDPOINT, body, apiKey, timeoutMs);
}

/**
 * Organic + local rank of `target` in a Serper response. Mirrors `_rank`:
 *  - organic: substring match either way between target host and result host.
 *  - local: brand-token (first label of the domain, >=4 chars) appears in the
 *    place title (Google shows the business name, not a domain).
 */
function rankFrom(data: SerperResponse, target: string): SerpRank {
  const td = host(target) || target.toLowerCase();
  const brand = td.split(".")[0];

  let organic: number | null = null;
  for (const o of data.organic ?? []) {
    const d = host(o.link ?? "");
    if (td && d && (d.includes(td) || td.includes(d))) {
      organic = o.position ?? null;
      break;
    }
  }

  let local: number | null = null;
  const places = data.places ?? [];
  for (let i = 0; i < places.length; i++) {
    const title = (places[i].title ?? "").replace(/ /g, "").toLowerCase();
    if (brand && brand.length >= 4 && title.includes(brand)) {
      local = places[i].position ?? i + 1;
      break;
    }
  }

  return { organic, local };
}

/**
 * Measure one keyword for one domain at one place. Throws if SERP_API_KEY is
 * unset or the provider call fails (callers decide how to degrade).
 */
export async function serpRank(
  keyword: string,
  where: SerpLocation,
  domain: string,
  opts: { provider?: string; num?: number; timeoutMs?: number } = {},
): Promise<SerpRank> {
  const key = process.env.SERP_API_KEY;
  if (!key) {
    throw new Error("SERP_API_KEY is not set — cannot measure real ranks.");
  }
  const provider = opts.provider ?? DEFAULT_PROVIDER;
  if (provider !== "serper") {
    throw new Error(`unknown SERP provider "${provider}"; only "serper" is wired`);
  }
  // Coordinates → local/map-pack (proximity-ranked, drives the heatmap decay).
  // Location string → organic /search (the keyword-refresh path).
  const data = where.lat != null && where.lng != null
    ? await fetchSerperMaps(keyword, where.lat, where.lng, key, opts.timeoutMs)
    : await fetchSerperSearch(keyword, where.location, key, opts.num, opts.timeoutMs);
  return rankFrom(data, domain);
}

/** True when a SERP key is configured (lets routes fall back without throwing). */
export function serpConfigured(): boolean {
  return !!process.env.SERP_API_KEY;
}
