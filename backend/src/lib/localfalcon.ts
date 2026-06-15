/**
 * LocalFalcon API client (server-side proxy). The API key stays on the backend
 * (LOCALFALCON_API_KEY) — never shipped to the browser. All LocalFalcon calls are
 * form-encoded POSTs; responses share an envelope { code, success, message, data }.
 *
 * Base: https://api.localfalcon.com  ·  docs: https://docs.localfalcon.com
 */

const LF_BASE = "https://api.localfalcon.com";

export function lfConfigured(): boolean {
  return !!process.env.LOCALFALCON_API_KEY;
}

interface LfEnvelope<T = unknown> {
  code: number;
  success: boolean;
  message: string | false;
  data: T;
}

/** Form-encoded POST to a LocalFalcon path; throws on transport/!success. */
async function lfPost<T = unknown>(path: string, params: Record<string, string | undefined>, timeoutMs = 30_000): Promise<T> {
  const key = process.env.LOCALFALCON_API_KEY;
  if (!key) throw new Error("LOCALFALCON_API_KEY is not set");

  const body = new URLSearchParams({ api_key: key });
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") body.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${LF_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    const json = (await res.json()) as LfEnvelope<T>;
    if (!json.success) {
      throw new Error(typeof json.message === "string" ? json.message : `LocalFalcon error (code ${json.code})`);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export interface LfReport {
  report_key: string; date: string; type: string; platform: string;
  location: string; keyword: string; lat: number; lng: number;
  grid_size: number; radius: number; measurement: string;
  found_in: number; data_points: number; arp: number; atrp: number; solv: number;
  image: string; heatmap: string; pdf: string; public_url: string;
}
export interface LfLocation {
  id: string; platform: string; place_id: string; name: string; address: string;
  lat: number; lng: number; rating: number | null; reviews: number | null;
  store_code: string | null; url: string; phone: string | null; categories: string[];
}

export function listReports(p: { keyword?: string; place_id?: string; grid_size?: string; platform?: string; limit?: string; next_token?: string }) {
  return lfPost<{ total: number; count: number; next_token: string | null; reports: LfReport[] }>("/v1/reports/", p);
}
export function getReport(reportKey: string) {
  return lfPost(`/v1/reports/${encodeURIComponent(reportKey)}/`, {});
}
export function listLocations(p: { query?: string; limit?: string; next_token?: string }) {
  return lfPost<{ total: number; count: number; next_token: string | null; locations: LfLocation[] }>("/v1/locations/", p);
}
export function runScan(p: {
  place_id: string; keyword: string; lat: string; lng: string;
  grid_size: string; radius: string; measurement: string; platform: string; ai_analysis?: string;
}) {
  // eager=true → LocalFalcon returns the finished scan within ~20s (under our proxy/CDN timeout).
  return lfPost("/v2/run-scan/", { ...p, eager: "true" }, 60_000);
}
