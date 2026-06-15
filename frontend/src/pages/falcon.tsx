import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, MapPin, ExternalLink, FileText, Search, Star, RefreshCw, AlertTriangle } from "lucide-react";

const PLATFORMS = ["google", "apple", "gaio", "aimode", "chatgpt", "gemini", "grok"];
const GRID_SIZES = ["3", "5", "7", "9", "11", "13", "15"];

type LfLocation = {
  id: string; place_id: string; name: string; address: string; lat: string | number; lng: string | number;
  rating?: number | string | null; reviews?: number | string | null; primary_category?: string | null;
};
// `location` on a report is a nested object (place_id/name/address/lat/lng…).
type LfReport = {
  report_key: string; date: string; platform: string; keyword: string;
  location: { name?: string; address?: string } | string;
  grid_size: number | string; radius: number | string; measurement: string;
  arp: number | string; solv: number | string; found_in?: number | string; data_points?: number | string;
  heatmap: string; image?: string; pdf: string; public_url: string;
};

function authFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("seo_admin_token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  });
}

function solvColor(solv: number): string {
  if (solv >= 50) return "bg-green-500/15 text-green-600 border-green-500/30";
  if (solv >= 20) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-red-500/15 text-red-600 border-red-500/30";
}
const locName = (l: LfReport["location"]) => (typeof l === "string" ? l : l?.name || l?.address || "—");

export default function Falcon() {
  const { toast } = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"reports" | "locations">("reports");

  useEffect(() => {
    authFetch("/api/falcon/status").then(r => setConfigured(r.configured)).catch(() => setConfigured(false));
  }, []);

  // ---- Reports ----
  const [kw, setKw] = useState("");
  const [platform, setPlatform] = useState("all");
  const [gridSize, setGridSize] = useState("all");
  const [reports, setReports] = useState<LfReport[]>([]);
  const [repTotal, setRepTotal] = useState(0);
  const [repToken, setRepToken] = useState<string | null>(null);
  const [repLoading, setRepLoading] = useState(false);

  const loadReports = useCallback(async (append: boolean, token?: string | null) => {
    setRepLoading(true);
    try {
      const p = new URLSearchParams({ limit: "12" });
      if (kw.trim()) p.set("keyword", kw.trim());
      if (platform !== "all") p.set("platform", platform);
      if (gridSize !== "all") p.set("grid_size", gridSize);
      if (token) p.set("next_token", token);
      const r = await authFetch(`/api/falcon/reports?${p.toString()}`);
      setRepTotal(r.total ?? 0);
      setRepToken(r.next_token ?? null);
      setReports(prev => append ? [...prev, ...(r.reports ?? [])] : (r.reports ?? []));
    } catch (e) {
      toast({ title: "Couldn't load reports", description: (e as Error).message, variant: "destructive" });
    } finally { setRepLoading(false); }
  }, [kw, platform, gridSize, toast]);

  useEffect(() => { if (configured) loadReports(false); }, [configured]); // initial

  // ---- Locations ----
  const [locQuery, setLocQuery] = useState("");
  const [locations, setLocations] = useState<LfLocation[]>([]);
  const [locTotal, setLocTotal] = useState(0);
  const [locToken, setLocToken] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const loadLocations = useCallback(async (append: boolean, token?: string | null) => {
    setLocLoading(true);
    try {
      const p = new URLSearchParams({ limit: "12" });
      if (locQuery.trim()) p.set("query", locQuery.trim());
      if (token) p.set("next_token", token);
      const r = await authFetch(`/api/falcon/locations?${p.toString()}`);
      setLocTotal(r.total ?? 0);
      setLocToken(r.next_token ?? null);
      setLocations(prev => append ? [...prev, ...(r.locations ?? [])] : (r.locations ?? []));
    } catch (e) {
      toast({ title: "Couldn't load locations", description: (e as Error).message, variant: "destructive" });
    } finally { setLocLoading(false); }
  }, [locQuery, toast]);

  useEffect(() => { if (configured && tab === "locations" && locations.length === 0) loadLocations(false); }, [configured, tab]);

  // ---- Run Scan ----
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLoc, setScanLoc] = useState<LfLocation | null>(null);
  const [scanForm, setScanForm] = useState({ keyword: "", gridSize: "7", radius: "1", measurement: "mi", platform: "google" });
  const [scanLocSearch, setScanLocSearch] = useState("");
  const [scanLocResults, setScanLocResults] = useState<LfLocation[]>([]);
  const [scanning, setScanning] = useState(false);

  const openScan = (loc?: LfLocation) => { setScanLoc(loc ?? null); setScanOpen(true); };
  const searchScanLocs = async (q: string) => {
    setScanLocSearch(q);
    if (!q.trim()) { setScanLocResults([]); return; }
    try {
      const r = await authFetch(`/api/falcon/locations?limit=6&query=${encodeURIComponent(q.trim())}`);
      setScanLocResults(r.locations ?? []);
    } catch { /* ignore */ }
  };
  const runScan = async () => {
    if (!scanLoc) { toast({ title: "Pick a location first", variant: "destructive" }); return; }
    if (!scanForm.keyword.trim()) { toast({ title: "Enter a keyword", variant: "destructive" }); return; }
    setScanning(true);
    try {
      await authFetch("/api/falcon/run-scan", {
        method: "POST",
        body: JSON.stringify({
          place_id: scanLoc.place_id, keyword: scanForm.keyword.trim(),
          lat: String(scanLoc.lat), lng: String(scanLoc.lng),
          grid_size: scanForm.gridSize, radius: scanForm.radius, measurement: scanForm.measurement, platform: scanForm.platform,
        }),
      });
      toast({ title: "Scan complete", description: `${scanForm.keyword} · ${locName(scanLoc as unknown as LfReport["location"]) }` });
      setScanOpen(false); setScanLoc(null); setScanLocSearch(""); setScanLocResults([]);
      setScanForm({ keyword: "", gridSize: "7", radius: "1", measurement: "mi", platform: "google" });
      setTab("reports"); loadReports(false);
    } catch (e) {
      toast({ title: "Scan failed", description: (e as Error).message, variant: "destructive" });
    } finally { setScanning(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2"><Zap className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Falcon</h1>
            <p className="text-muted-foreground mt-0.5">LocalFalcon — geo-grid scans, heatmaps & local rankings</p>
          </div>
        </div>
        <Button onClick={() => openScan()} className="gap-2" disabled={!configured}>
          <Zap className="w-4 h-4" /> Run Scan
        </Button>
      </div>

      {configured === false && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-400">LocalFalcon not configured</p>
            <p className="text-muted-foreground">Set <code>LOCALFALCON_API_KEY</code> on the backend to enable scans, heatmaps, and locations.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["reports", "locations"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t} {t === "reports" && repTotal ? `(${repTotal.toLocaleString()})` : t === "locations" && locTotal ? `(${locTotal.toLocaleString()})` : ""}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={kw} onChange={e => setKw(e.target.value)} placeholder="Filter by keyword…" className="pl-8"
                onKeyDown={e => { if (e.key === "Enter") loadReports(false); }} />
            </div>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All platforms</SelectItem>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={gridSize} onValueChange={setGridSize}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Grid" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Any grid</SelectItem>{GRID_SIZES.map(g => <SelectItem key={g} value={g}>{g}×{g}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => loadReports(false)} disabled={repLoading} className="gap-1.5">
              {repLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Apply
            </Button>
          </div>

          {repLoading && reports.length === 0 ? (
            <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : reports.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No scan reports found.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map(r => {
                const solv = Number(r.solv) || 0;
                return (
                  <div key={r.report_key} className="rounded-xl border bg-card overflow-hidden flex flex-col">
                    {r.heatmap && <img src={r.heatmap} alt="heatmap" loading="lazy" className="w-full aspect-square object-cover bg-muted" />}
                    <div className="p-3 space-y-2 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm leading-tight">{r.keyword}</span>
                        <Badge variant="outline" className={`shrink-0 ${solvColor(solv)}`}>SoLV {solv.toFixed(0)}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{locName(r.location)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted">{r.grid_size}×{r.grid_size}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted">ARP {Number(r.arp).toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted capitalize">{r.platform}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{r.date}</div>
                      <div className="flex gap-2 mt-auto pt-1">
                        {r.public_url && <a href={r.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" />Report</a>}
                        {r.pdf && <a href={r.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><FileText className="w-3 h-3" />PDF</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {repToken && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadReports(true, repToken)} disabled={repLoading} className="gap-1.5">
                {repLoading && <Loader2 className="w-4 h-4 animate-spin" />} Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "locations" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={locQuery} onChange={e => setLocQuery(e.target.value)} placeholder="Search locations…" className="pl-8"
              onKeyDown={e => { if (e.key === "Enter") loadLocations(false); }} />
          </div>
          {locLoading && locations.length === 0 ? (
            <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map(l => (
                <div key={l.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                  <div className="font-semibold text-sm leading-tight">{l.name}</div>
                  <div className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3 shrink-0 mt-0.5" /><span>{l.address}</span></div>
                  <div className="flex items-center justify-between">
                    {Number(l.rating) > 0
                      ? <span className="inline-flex items-center gap-1 text-xs"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{Number(l.rating).toFixed(1)} ({l.reviews})</span>
                      : <span className="text-xs text-muted-foreground">No reviews</span>}
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openScan(l)}><Zap className="w-3 h-3" />Scan</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {locToken && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadLocations(true, locToken)} disabled={locLoading} className="gap-1.5">
                {locLoading && <Loader2 className="w-4 h-4 animate-spin" />} Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Run Scan dialog */}
      <Dialog open={scanOpen} onOpenChange={v => { if (!v) setScanOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Run a LocalFalcon scan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              {scanLoc ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{scanLoc.name}</p><p className="text-xs text-muted-foreground truncate">{scanLoc.address}</p></div>
                  <Button variant="ghost" size="sm" onClick={() => setScanLoc(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <Input value={scanLocSearch} onChange={e => searchScanLocs(e.target.value)} placeholder="Search your locations…" />
                  {scanLocResults.length > 0 && (
                    <div className="rounded-md border divide-y max-h-44 overflow-y-auto">
                      {scanLocResults.map(l => (
                        <button key={l.id} type="button" onClick={() => { setScanLoc(l); setScanLocResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50">
                          <p className="text-sm font-medium truncate">{l.name}</p><p className="text-xs text-muted-foreground truncate">{l.address}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Keyword</Label>
              <Input value={scanForm.keyword} onChange={e => setScanForm(f => ({ ...f, keyword: e.target.value }))} placeholder="e.g. roofing contractor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Grid size</Label>
                <Select value={scanForm.gridSize} onValueChange={v => setScanForm(f => ({ ...f, gridSize: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GRID_SIZES.map(g => <SelectItem key={g} value={g}>{g}×{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Platform</Label>
                <Select value={scanForm.platform} onValueChange={v => setScanForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Radius</Label>
                <Input type="number" min="0.1" step="0.1" value={scanForm.radius} onChange={e => setScanForm(f => ({ ...f, radius: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>Unit</Label>
                <Select value={scanForm.measurement} onValueChange={v => setScanForm(f => ({ ...f, measurement: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mi">miles</SelectItem><SelectItem value="km">km</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Running a scan spends LocalFalcon credits.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)} disabled={scanning}>Cancel</Button>
            <Button onClick={runScan} disabled={scanning || !scanLoc || !scanForm.keyword.trim()}>
              {scanning && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Run scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
