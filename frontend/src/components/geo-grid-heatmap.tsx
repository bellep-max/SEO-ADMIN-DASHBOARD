import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Download, MapPin, RefreshCw, Map } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Campaign } from "@workspace/api-client-react";

type BusinessProfile = { id: number; businessName: string };

type GeoGridConfig = {
  id: number;
  clientId: number;
  campaignId: number | null;
  businessId: number | null;
  keyword: string;
  centerAddress: string | null;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  gridSize: number;
  createdAt: string;
  lastGeneratedAt: string | null;
  campaignName: string | null;
  businessName: string | null;
};

type GeoGridResult = {
  id: number;
  configId: number;
  gridRow: number;
  gridCol: number;
  lat: number;
  lng: number;
  rank: number | null;
  generatedAt: string;
};

function authFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("seo_admin_token") ?? "";
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    if (res.status === 204) return null;
    return res.json();
  });
}

function getRankColor(rank: number | null): { bg: string; text: string; border: string } {
  if (rank == null) return { bg: "#6b7280", text: "#ffffff", border: "#4b5563" };
  if (rank <= 3) return { bg: "#16a34a", text: "#ffffff", border: "#15803d" };
  if (rank <= 7) return { bg: "#84cc16", text: "#1a2e05", border: "#65a30d" };
  if (rank <= 13) return { bg: "#eab308", text: "#1a1a00", border: "#ca8a04" };
  if (rank <= 20) return { bg: "#f97316", text: "#ffffff", border: "#ea580c" };
  return { bg: "#dc2626", text: "#ffffff", border: "#b91c1c" };
}

function rankLabel(rank: number | null): string {
  if (rank == null) return "—";
  if (rank >= 30) return "30+";
  return String(rank);
}

function GeoGrid({ config, results }: { config: GeoGridConfig; results: GeoGridResult[] }) {
  const size = config.gridSize;
  const grid: (GeoGridResult | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  results.forEach((r) => {
    if (r.gridRow < size && r.gridCol < size) grid[r.gridRow][r.gridCol] = r;
  });

  const avgRank = results.filter(r => r.rank != null).reduce((s, r) => s + r.rank!, 0) / (results.filter(r => r.rank != null).length || 1);
  const top3 = results.filter(r => r.rank != null && r.rank <= 3).length;
  const top10 = results.filter(r => r.rank != null && r.rank <= 10).length;
  const total = results.length;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      {results.length > 0 && (
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">Avg rank: <span className="font-semibold text-foreground">{avgRank.toFixed(1)}</span></span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] inline-block" /> Top 3: <span className="font-semibold">{top3}/{total}</span></span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#84cc16] inline-block" /> Top 10: <span className="font-semibold">{top10}/{total}</span></span>
        </div>
      )}

      {/* Grid */}
      <div className="inline-block border rounded-lg overflow-hidden bg-muted/20 p-2">
        {grid.map((row, ri) => (
          <div key={ri} className="flex gap-1 mb-1">
            {row.map((cell, ci) => {
              const isCenter = ri === Math.floor(size / 2) && ci === Math.floor(size / 2);
              const colors = getRankColor(cell?.rank ?? null);
              return (
                <div
                  key={ci}
                  className="relative flex items-center justify-center rounded-full text-[11px] font-bold select-none"
                  style={{
                    width: size <= 5 ? 44 : size <= 7 ? 36 : 28,
                    height: size <= 5 ? 44 : size <= 7 ? 36 : 28,
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: isCenter ? `3px solid #1d4ed8` : `2px solid ${colors.border}`,
                    boxShadow: isCenter ? "0 0 0 2px #93c5fd" : undefined,
                    fontSize: size > 7 ? 10 : 12,
                  }}
                  title={`Row ${ri}, Col ${ci} — Rank: ${cell?.rank ?? "N/A"}\nLat: ${cell?.lat?.toFixed(4)}, Lng: ${cell?.lng?.toFixed(4)}`}
                >
                  {results.length === 0 ? "?" : rankLabel(cell?.rank ?? null)}
                  {isCenter && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" title="Center (business location)" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legend:</span>
        {[
          { label: "1–3", bg: "#16a34a" },
          { label: "4–7", bg: "#84cc16" },
          { label: "8–13", bg: "#eab308" },
          { label: "14–20", bg: "#f97316" },
          { label: "21+", bg: "#dc2626" },
          { label: "No rank", bg: "#6b7280" },
        ].map(({ label, bg }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: bg }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="w-3 h-3 rounded-full inline-block bg-blue-600 border-2 border-blue-300" />
          Center
        </span>
      </div>
    </div>
  );
}

type Props = {
  clientId: number;
  clientName: string;
  campaigns: Campaign[];
  businesses: BusinessProfile[];
};

export function GeoGridHeatmap({ clientId, clientName, campaigns, businesses }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const configsKey = [`/api/geo-grids?clientId=${clientId}`];
  const { data: configs = [], isLoading } = useQuery<GeoGridConfig[]>({
    queryKey: configsKey,
    queryFn: () => authFetch(`/api/geo-grids?clientId=${clientId}`),
    enabled: clientId > 0,
  });

  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const selectedConfig = configs.find(c => c.id === selectedConfigId) ?? null;

  const resultsKey = selectedConfigId ? [`/api/geo-grids/${selectedConfigId}/results`] : null;
  const { data: results = [] } = useQuery<GeoGridResult[]>({
    queryKey: resultsKey!,
    queryFn: () => authFetch(`/api/geo-grids/${selectedConfigId}/results`),
    enabled: !!selectedConfigId,
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);

  const [form, setForm] = useState({
    keyword: "",
    centerAddress: "",
    centerLat: "",
    centerLng: "",
    radiusMiles: "5",
    gridSize: "5",
    campaignId: "none",
    businessId: "none",
  });

  async function geocodeAddress() {
    if (!form.centerAddress.trim()) {
      toast({ title: "Enter an address first", variant: "destructive" });
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.centerAddress)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (!data[0]) {
        toast({ title: "Address not found", variant: "destructive" });
        return;
      }
      setForm(f => ({ ...f, centerLat: parseFloat(data[0].lat).toFixed(6), centerLng: parseFloat(data[0].lon).toFixed(6) }));
      toast({ title: "Coordinates found", description: `${data[0].display_name}` });
    } catch {
      toast({ title: "Geocoding failed", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: object) => authFetch("/api/geo-grids", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (newCfg: GeoGridConfig) => {
      queryClient.invalidateQueries({ queryKey: configsKey });
      setIsAddOpen(false);
      setForm({ keyword: "", centerAddress: "", centerLat: "", centerLng: "", radiusMiles: "5", gridSize: "5", campaignId: "none", businessId: "none" });
      setSelectedConfigId(newCfg.id);
      toast({ title: "Heatmap grid created" });
    },
    onError: () => toast({ title: "Failed to create grid", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/geo-grids/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configsKey });
      if (selectedConfigId === deleteTarget) setSelectedConfigId(null);
      setDeleteTarget(null);
      toast({ title: "Grid deleted" });
    },
  });

  async function handleGenerate(id: number) {
    setGenerating(id);
    try {
      const newResults = await authFetch(`/api/geo-grids/${id}/generate`, { method: "POST" });
      queryClient.setQueryData([`/api/geo-grids/${id}/results`], newResults);
      queryClient.invalidateQueries({ queryKey: configsKey });
      toast({ title: "Heatmap generated", description: "Simulated ranks applied to all grid points." });
    } catch {
      toast({ title: "Generate failed", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.keyword.trim() || !form.centerLat || !form.centerLng) {
      toast({ title: "Keyword and coordinates are required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      clientId,
      keyword: form.keyword.trim(),
      centerAddress: form.centerAddress || null,
      centerLat: parseFloat(form.centerLat),
      centerLng: parseFloat(form.centerLng),
      radiusMiles: parseInt(form.radiusMiles),
      gridSize: parseInt(form.gridSize),
      campaignId: form.campaignId !== "none" ? parseInt(form.campaignId) : null,
      businessId: form.businessId !== "none" ? parseInt(form.businessId) : null,
    });
  }

  function handleDownloadPDF() {
    if (!selectedConfig) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const gridEl = document.getElementById(`geo-grid-print-${selectedConfig.id}`);
    if (!gridEl) return;
    const gridHtml = gridEl.outerHTML;
    const date = selectedConfig.lastGeneratedAt
      ? new Date(selectedConfig.lastGeneratedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Geo Grid Report - ${clientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: white; color: #111; padding: 40px; }
    .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 32px; }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header p { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .keyword-label { font-size: 13px; color: #6b7280; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .keyword-text { font-size: 28px; font-weight: 800; margin-bottom: 24px; color: #111; }
    .grid-wrap { display: inline-block; }
    .grid-row { display: flex; gap: 4px; margin-bottom: 4px; }
    .grid-cell { display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 12px; font-weight: 700; width: 44px; height: 44px; }
    .footer-bar { margin-top: 32px; background: #1e293b; color: white; padding: 12px 20px; border-radius: 6px; display: flex; justify-content: space-between; font-size: 13px; }
    .legend { display: flex; gap: 12px; align-items: center; margin-top: 20px; flex-wrap: wrap; font-size: 12px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 4px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${clientName}</h1>
    <p>Report Date: ${date}</p>
  </div>
  <div class="keyword-label">Keyword</div>
  <div class="keyword-text">${selectedConfig.keyword}</div>
  ${gridHtml}
  <div class="footer-bar">
    <span>LATEST RANK DATE:</span>
    <span>${date}</span>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
    printWindow.document.close();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Geo-Grid Heatmap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Rank distribution across geographic locations</p>
        </div>
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Grid
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Config list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Keywords</p>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
              <Map className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              No grids yet.<br />Click "Add Grid" to start.
            </div>
          ) : (
            configs.map(cfg => (
              <div
                key={cfg.id}
                className={`group flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedConfigId === cfg.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                onClick={() => setSelectedConfigId(cfg.id)}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{cfg.keyword}</p>
                  {cfg.campaignName && <p className="text-xs text-muted-foreground truncate">{cfg.campaignName}</p>}
                  {cfg.businessName && <p className="text-xs text-muted-foreground truncate">{cfg.businessName}</p>}
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{cfg.gridSize}×{cfg.gridSize} · {cfg.radiusMiles}mi radius</p>
                  {cfg.lastGeneratedAt && (
                    <Badge variant="secondary" className="text-[10px] mt-1 h-4">
                      {new Date(cfg.lastGeneratedAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(cfg.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Grid display */}
        <div className="md:col-span-2">
          {!selectedConfig ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border rounded-lg">
              <Map className="w-10 h-10 mb-2 text-muted-foreground/30" />
              <p className="text-sm">Select a keyword grid to view the heatmap</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selectedConfig.keyword}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedConfig.campaignName && <Badge variant="secondary" className="text-xs">{selectedConfig.campaignName}</Badge>}
                      {selectedConfig.businessName && <Badge variant="outline" className="text-xs">{selectedConfig.businessName}</Badge>}
                      {selectedConfig.centerAddress && (
                        <span className="flex items-center text-xs text-muted-foreground gap-1">
                          <MapPin className="w-3 h-3" />{selectedConfig.centerAddress}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleGenerate(selectedConfig.id)}
                      disabled={generating === selectedConfig.id}
                    >
                      {generating === selectedConfig.id
                        ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        : <RefreshCw className="w-4 h-4 mr-1.5" />}
                      Generate
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={results.length === 0}>
                      <Download className="w-4 h-4 mr-1.5" /> PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <p>No data yet.</p>
                    <p className="text-xs mt-1">Click "Generate" to simulate a rank scan.</p>
                    <div className="mt-4">
                      <GeoGrid config={selectedConfig} results={[]} />
                    </div>
                  </div>
                ) : (
                  <div id={`geo-grid-print-${selectedConfig.id}`}>
                    <GeoGrid config={selectedConfig} results={results} />
                  </div>
                )}
                {selectedConfig.lastGeneratedAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last generated: {new Date(selectedConfig.lastGeneratedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Grid Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Geo-Grid Heatmap</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Keyword <span className="text-destructive">*</span></Label>
              <Input
                required
                placeholder="e.g. tummy tuck"
                value={form.keyword}
                onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Campaign (optional)</Label>
              <Select value={form.campaignId} onValueChange={v => setForm(f => ({ ...f, campaignId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Business (optional)</Label>
              <Select value={form.businessId} onValueChange={v => setForm(f => ({ ...f, businessId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select business..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No business</SelectItem>
                  {businesses.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.businessName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Center Address <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Houston, TX"
                  value={form.centerAddress}
                  onChange={e => setForm(f => ({ ...f, centerAddress: e.target.value }))}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={geocodeAddress} disabled={geocoding} className="shrink-0">
                  {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Latitude <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="29.7604"
                  value={form.centerLat}
                  onChange={e => setForm(f => ({ ...f, centerLat: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Longitude <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="-95.3698"
                  value={form.centerLng}
                  onChange={e => setForm(f => ({ ...f, centerLng: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Radius (miles)</Label>
                <Select value={form.radiusMiles} onValueChange={v => setForm(f => ({ ...f, radiusMiles: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 5, 7, 10, 15, 20].map(r => (
                      <SelectItem key={r} value={String(r)}>{r} miles</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Grid Size</Label>
                <Select value={form.gridSize} onValueChange={v => setForm(f => ({ ...f, gridSize: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 9].map(s => (
                      <SelectItem key={s} value={String(s)}>{s}×{s} ({s * s} points)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Grid
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this grid?</AlertDialogTitle>
            <AlertDialogDescription>All results for this grid will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget != null && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
