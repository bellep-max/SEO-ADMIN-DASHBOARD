import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, MapPin, ExternalLink, FileText, Link2, AlertTriangle } from "lucide-react";

const PLATFORMS = ["google", "apple", "gaio", "aimode", "chatgpt", "gemini", "grok"];
const GRID_SIZES = ["3", "5", "7", "9", "11", "13", "15"];

type BusinessProfile = {
  id: number; businessName: string; address: string | null;
  localFalconPlaceId?: string | null; localFalconName?: string | null;
};
type LfLocation = { id: string; place_id: string; name: string; address: string; lat: string | number; lng: string | number };
type LfReport = {
  report_key: string; date: string; platform: string; keyword: string;
  location: { name?: string } | string; grid_size: number | string;
  arp: number | string; solv: number | string; heatmap: string; pdf: string; public_url: string;
};

function authFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("seo_admin_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) } })
    .then(async (res) => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText); return res.json(); });
}
function solvColor(s: number) {
  if (s >= 50) return "bg-green-500/15 text-green-600 border-green-500/30";
  if (s >= 20) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-red-500/15 text-red-600 border-red-500/30";
}

export function LocalFalconClient({ businesses, onLinked }: { businesses: BusinessProfile[]; onLinked: () => void }) {
  const { toast } = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { authFetch("/api/falcon/status").then(r => setConfigured(r.configured)).catch(() => setConfigured(false)); }, []);

  const linked = businesses.filter(b => b.localFalconPlaceId);
  const placeIds = linked.map(b => b.localFalconPlaceId).join(",");

  // ---- linking ----
  const [linkFor, setLinkFor] = useState<BusinessProfile | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LfLocation[]>([]);
  const [linking, setLinking] = useState(false);
  const doSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setResults([]); return; }
    try { const r = await authFetch(`/api/falcon/locations?limit=6&query=${encodeURIComponent(q.trim())}`); setResults(r.locations ?? []); } catch { /* ignore */ }
  };
  const link = async (loc: LfLocation) => {
    if (!linkFor) return;
    setLinking(true);
    try {
      await authFetch(`/api/businesses/${linkFor.id}`, { method: "PATCH", body: JSON.stringify({ localFalconPlaceId: loc.place_id, localFalconName: loc.name }) });
      toast({ title: "Location linked", description: `${linkFor.businessName} → ${loc.name}` });
      setLinkFor(null); setSearch(""); setResults([]); onLinked();
    } catch (e) { toast({ title: "Link failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setLinking(false); }
  };
  const unlink = async (b: BusinessProfile) => {
    try {
      await authFetch(`/api/businesses/${b.id}`, { method: "PATCH", body: JSON.stringify({ localFalconPlaceId: "", localFalconName: "" }) });
      onLinked();
    } catch (e) { toast({ title: "Unlink failed", description: (e as Error).message, variant: "destructive" }); }
  };

  // ---- reports (scoped to linked place_ids) ----
  const [reports, setReports] = useState<LfReport[]>([]);
  const [loading, setLoading] = useState(false);
  const loadReports = useCallback(async () => {
    if (!placeIds) { setReports([]); return; }
    setLoading(true);
    try { const r = await authFetch(`/api/falcon/reports?place_id=${encodeURIComponent(placeIds)}&limit=12`); setReports(r.reports ?? []); }
    catch (e) { toast({ title: "Couldn't load reports", description: (e as Error).message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, [placeIds, toast]);
  useEffect(() => { if (configured) loadReports(); }, [configured, placeIds]);

  // ---- scoped run scan ----
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBizId, setScanBizId] = useState<string>("");
  const [scanForm, setScanForm] = useState({ keyword: "", gridSize: "7", radius: "1", measurement: "mi", platform: "google" });
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const openScan = () => { setScanBizId(linked[0]?.id.toString() ?? ""); setScanOpen(true); };

  const runScan = async () => {
    const biz = linked.find(b => b.id.toString() === scanBizId);
    if (!biz?.localFalconPlaceId) { toast({ title: "Pick a linked location", variant: "destructive" }); return; }
    if (!scanForm.keyword.trim()) { toast({ title: "Enter a keyword", variant: "destructive" }); return; }
    setScanning(true);
    let reportKey: string | undefined;
    try {
      // resolve lat/lng for the linked place from LocalFalcon
      const locRes = await authFetch(`/api/falcon/locations?limit=1&query=${encodeURIComponent(biz.localFalconPlaceId)}`);
      const loc: LfLocation | undefined = (locRes.locations ?? [])[0];
      if (!loc) throw new Error("Couldn't resolve the linked location's coordinates.");
      const res = await authFetch("/api/falcon/run-scan", {
        method: "POST",
        body: JSON.stringify({
          place_id: biz.localFalconPlaceId, keyword: scanForm.keyword.trim(),
          lat: String(loc.lat), lng: String(loc.lng),
          grid_size: scanForm.gridSize, radius: scanForm.radius, measurement: scanForm.measurement, platform: scanForm.platform,
        }),
      });
      reportKey = res?.report_key;
    } catch (e) { toast({ title: "Scan failed", description: (e as Error).message, variant: "destructive" }); setScanning(false); return; }
    setScanning(false); setScanOpen(false);
    setScanForm({ keyword: "", gridSize: "7", radius: "1", measurement: "mi", platform: "google" });
    toast({ title: "Scan started", description: "LocalFalcon is processing — this can take a minute." });
    if (!reportKey) { loadReports(); return; }
    setProcessing(true);
    try {
      for (let i = 0; i < 18; i++) {
        await new Promise(r => setTimeout(r, 10000));
        try { const rep = await authFetch(`/api/falcon/reports/${reportKey}`); if (rep?.status !== "processing") { toast({ title: "Scan complete 🦅" }); break; } } catch { /* keep polling */ }
      }
    } finally { setProcessing(false); loadReports(); }
  };

  if (configured === false) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm"><p className="font-semibold text-amber-700 dark:text-amber-400">LocalFalcon not configured</p>
          <p className="text-muted-foreground">Set <code>LOCALFALCON_API_KEY</code> on the backend to enable this.</p></div>
      </div>
    );
  }
  if (businesses.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Add a business profile first, then link it to a LocalFalcon location.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Linking panel */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold"><Link2 className="w-4 h-4 text-primary" />LocalFalcon locations</div>
          {placeIds && <Button size="sm" onClick={openScan} className="gap-1.5"><Zap className="w-3.5 h-3.5" />Run scan</Button>}
        </div>
        <div className="space-y-1.5">
          {businesses.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
              <div className="min-w-0">
                <span className="font-medium">{b.businessName}</span>
                {b.localFalconPlaceId
                  ? <span className="text-xs text-muted-foreground ml-2">→ {b.localFalconName || b.localFalconPlaceId}</span>
                  : <span className="text-xs text-muted-foreground ml-2">not linked</span>}
              </div>
              {b.localFalconPlaceId
                ? <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unlink(b)}>Unlink</Button>
                : <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setLinkFor(b); setSearch(""); setResults([]); }}><Link2 className="w-3 h-3" />Link</Button>}
            </div>
          ))}
        </div>
      </div>

      {processing && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" /><span>Scan running on LocalFalcon — the new report will appear here shortly.</span>
        </div>
      )}

      {/* Scoped reports */}
      {!placeIds ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Link a location above to see its geo-grid heatmaps here.</div>
      ) : loading && reports.length === 0 ? (
        <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No scans yet for this location. Click “Run scan”.</div>
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

      {/* Link picker dialog */}
      <Dialog open={!!linkFor} onOpenChange={v => { if (!v) setLinkFor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Link a LocalFalcon location</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Linking <span className="font-medium text-foreground">{linkFor?.businessName}</span> to a LocalFalcon location.</p>
            <Input autoFocus value={search} onChange={e => doSearch(e.target.value)} placeholder="Search name, address, or Place ID…" />
            <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
              {results.map(l => (
                <button key={l.id} type="button" disabled={linking} onClick={() => link(l)} className="w-full text-left px-3 py-2 hover:bg-muted/50 disabled:opacity-50">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{l.address}</p>
                </button>
              ))}
              {search && results.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No matches.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run Scan dialog */}
      <Dialog open={scanOpen} onOpenChange={v => { if (!v) setScanOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Run a scan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {linked.length > 1 && (
              <div className="space-y-1.5"><Label>Location</Label>
                <Select value={scanBizId} onValueChange={setScanBizId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{linked.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.localFalconName || b.businessName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Keyword</Label>
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
            <Button onClick={runScan} disabled={scanning || !scanForm.keyword.trim()}>{scanning && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Run scan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
