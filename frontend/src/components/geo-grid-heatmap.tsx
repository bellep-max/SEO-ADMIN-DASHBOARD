import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Download, MapPin, RefreshCw, Map, Zap } from "lucide-react";
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

function getRankColor(rank: number | null): { bg: string; text: string } {
  if (rank == null) return { bg: "#9ca3af", text: "#ffffff" };
  if (rank <= 3)  return { bg: "#22c55e", text: "#ffffff" };
  if (rank <= 10) return { bg: "#facc15", text: "#1a1a00" };
  if (rank <= 20) return { bg: "#f97316", text: "#ffffff" };
  return { bg: "#ef4444", text: "#ffffff" };
}

function rankLabel(rank: number | null): string {
  if (rank == null) return "—";
  if (rank >= 30) return "30+";
  return String(rank);
}

const LEGEND = [
  { label: "1–3",   bg: "#22c55e" },
  { label: "4–10",  bg: "#facc15" },
  { label: "11–20", bg: "#f97316" },
  { label: "21+",   bg: "#ef4444" },
];

function GridDisplay({ config, results }: { config: GeoGridConfig; results: GeoGridResult[] }) {
  const size = config.gridSize;
  const grid: (GeoGridResult | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  results.forEach((r) => {
    if (r.gridRow < size && r.gridCol < size) grid[r.gridRow][r.gridCol] = r;
  });

  const hasData = results.length > 0;
  const dotSize = size <= 3 ? 56 : size <= 5 ? 48 : size <= 7 ? 38 : 30;
  const fontSize = size <= 5 ? 14 : size <= 7 ? 12 : 10;
  const gap = size <= 5 ? 6 : 4;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: gap,
        padding: 12,
        background: "rgba(255,255,255,0.05)",
        borderRadius: 10,
      }}
    >
      {grid.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap }}>
          {row.map((cell, ci) => {
            const isCenter = ri === Math.floor(size / 2) && ci === Math.floor(size / 2);
            const colors = hasData ? getRankColor(cell?.rank ?? null) : { bg: "#374151", text: "#9ca3af" };
            return (
              <div
                key={ci}
                title={`Rank: ${cell?.rank ?? "N/A"} | Lat: ${cell?.lat?.toFixed(4)}, Lng: ${cell?.lng?.toFixed(4)}`}
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize,
                  fontWeight: 800,
                  color: hasData ? colors.text : "#6b7280",
                  backgroundColor: hasData ? colors.bg : "#1f2937",
                  border: isCenter
                    ? "3px solid #60a5fa"
                    : `2px solid ${hasData ? colors.bg : "#374151"}`,
                  boxShadow: isCenter ? "0 0 0 3px rgba(96,165,250,0.35)" : "none",
                  position: "relative",
                  cursor: "default",
                  userSelect: "none",
                  flexShrink: 0,
                }}
              >
                {hasData ? rankLabel(cell?.rank ?? null) : "?"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ReportCard({
  config,
  results,
  clientName,
  generating,
  onGenerate,
  onDelete,
  onDownloadPDF,
  isSelected,
  onClick,
}: {
  config: GeoGridConfig;
  results: GeoGridResult[];
  clientName: string;
  generating: boolean;
  onGenerate: () => void;
  onDelete: () => void;
  onDownloadPDF: () => void;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasData = results.length > 0;
  const date = config.lastGeneratedAt
    ? new Date(config.lastGeneratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Not generated";

  const top3 = results.filter(r => r.rank != null && r.rank <= 3).length;
  const top10 = results.filter(r => r.rank != null && r.rank <= 10).length;
  const avgRank = hasData
    ? (results.filter(r => r.rank != null).reduce((s, r) => s + r.rank!, 0) / results.filter(r => r.rank != null).length).toFixed(1)
    : null;

  return (
    <div
      id={`geo-grid-card-${config.id}`}
      onClick={onClick}
      style={{
        background: "#0f172a",
        borderRadius: 12,
        overflow: "hidden",
        border: isSelected ? "2px solid #3b82f6" : "2px solid #1e293b",
        cursor: "pointer",
        transition: "border-color 0.15s",
        minWidth: 0,
      }}
    >
      {/* Card top bar */}
      <div style={{ background: "#1e293b", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            {clientName}
          </span>
          {config.campaignName && (
            <span style={{ background: "#334155", color: "#94a3b8", fontSize: 10, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
              {config.campaignName}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onGenerate}
            disabled={generating}
            title="Generate ranks"
            style={{ background: "#334155", border: "none", borderRadius: 6, padding: "4px 10px", color: "#e2e8f0", fontSize: 11, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, opacity: generating ? 0.6 : 1 }}
          >
            {generating ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <RefreshCw style={{ width: 12, height: 12 }} />}
            Generate
          </button>
          <button
            onClick={onDownloadPDF}
            disabled={!hasData}
            title="Download PDF"
            style={{ background: "#334155", border: "none", borderRadius: 6, padding: "4px 10px", color: "#e2e8f0", fontSize: 11, fontWeight: 600, cursor: !hasData ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, opacity: !hasData ? 0.4 : 1 }}
          >
            <Download style={{ width: 12, height: 12 }} />
            PDF
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            style={{ background: "transparent", border: "none", borderRadius: 6, padding: "4px 6px", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* Keyword name */}
      <div style={{ padding: "12px 14px 4px" }}>
        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Keyword</div>
        <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, lineHeight: 1.2, marginBottom: 8 }}>{config.keyword}</div>
        {config.centerAddress && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748b", fontSize: 11, marginBottom: 8 }}>
            <MapPin style={{ width: 11, height: 11 }} />
            {config.centerAddress}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ padding: "0 14px 10px", display: "flex", justifyContent: "center" }}>
        <GridDisplay config={config} results={results} />
      </div>

      {/* Stats row */}
      {hasData && (
        <div style={{ display: "flex", gap: 0, borderTop: "1px solid #1e293b" }}>
          {[
            { label: "AVG RANK", value: avgRank ?? "—" },
            { label: "TOP 3", value: `${top3}/${results.length}` },
            { label: "TOP 10", value: `${top10}/${results.length}` },
            { label: `${config.gridSize}×${config.gridSize} GRID`, value: `${config.radiusMiles}mi` },
          ].map(({ label, value }, i) => (
            <div key={i} style={{ flex: 1, padding: "8px 6px", textAlign: "center", borderRight: i < 3 ? "1px solid #1e293b" : "none" }}>
              <div style={{ color: "#475569", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 800, marginTop: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ background: "#0f172a", borderTop: "1px solid #1e293b", padding: "8px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {LEGEND.map(({ label, bg }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#94a3b8" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: bg, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: "#1e293b", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>LATEST RANK DATE</span>
        <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 600 }}>{date}</span>
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

  const configsKey = [`/api/geo-grids?clientId=${clientId}`];
  const { data: configs = [], isLoading } = useQuery<GeoGridConfig[]>({
    queryKey: configsKey,
    queryFn: () => authFetch(`/api/geo-grids?clientId=${clientId}`),
    enabled: clientId > 0,
  });

  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Per-card results cached in query cache
  function useCardResults(configId: number) {
    return useQuery<GeoGridResult[]>({
      queryKey: [`/api/geo-grids/${configId}/results`],
      queryFn: () => authFetch(`/api/geo-grids/${configId}/results`),
      enabled: configId > 0,
    });
  }

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
      if (!data[0]) { toast({ title: "Address not found", variant: "destructive" }); return; }
      setForm(f => ({ ...f, centerLat: parseFloat(data[0].lat).toFixed(6), centerLng: parseFloat(data[0].lon).toFixed(6) }));
      toast({ title: "Coordinates found", description: data[0].display_name });
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
      toast({ title: "Grid created" });
    },
    onError: () => toast({ title: "Failed to create grid", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/geo-grids/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: configsKey });
      if (selectedConfigId === id) setSelectedConfigId(null);
      setDeleteTarget(null);
      toast({ title: "Grid deleted" });
    },
  });

  async function handleGenerate(id: number) {
    setGeneratingIds(prev => new Set(prev).add(id));
    try {
      const newResults = await authFetch(`/api/geo-grids/${id}/generate`, { method: "POST" });
      queryClient.setQueryData([`/api/geo-grids/${id}/results`], newResults);
      queryClient.invalidateQueries({ queryKey: configsKey });
    } catch {
      toast({ title: "Generate failed", variant: "destructive" });
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function handleGenerateAll() {
    if (configs.length === 0) return;
    setGeneratingAll(true);
    toast({ title: `Generating ${configs.length} grids…` });
    let done = 0;
    await Promise.all(configs.map(async (cfg) => {
      try {
        const newResults = await authFetch(`/api/geo-grids/${cfg.id}/generate`, { method: "POST" });
        queryClient.setQueryData([`/api/geo-grids/${cfg.id}/results`], newResults);
        done++;
      } catch { /* skip failed */ }
    }));
    queryClient.invalidateQueries({ queryKey: configsKey });
    setGeneratingAll(false);
    toast({ title: `Generated ${done}/${configs.length} grids` });
  }

  function buildPrintHTML(cfg: GeoGridConfig, results: GeoGridResult[]) {
    const size = cfg.gridSize;
    const grid: (GeoGridResult | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    results.forEach(r => { if (r.gridRow < size && r.gridCol < size) grid[r.gridRow][r.gridCol] = r; });
    const dotPx = size <= 5 ? 52 : size <= 7 ? 42 : 34;
    const gap = size <= 5 ? 6 : 4;
    const date = cfg.lastGeneratedAt
      ? new Date(cfg.lastGeneratedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    function dotColor(rank: number | null) {
      if (rank == null) return { bg: "#9ca3af", text: "#fff" };
      if (rank <= 3)  return { bg: "#22c55e", text: "#fff" };
      if (rank <= 10) return { bg: "#facc15", text: "#1a1a00" };
      if (rank <= 20) return { bg: "#f97316", text: "#fff" };
      return { bg: "#ef4444", text: "#fff" };
    }

    const gridHtml = grid.map(row =>
      `<div style="display:flex;gap:${gap}px;margin-bottom:${gap}px">${row.map((cell, ci) => {
        const c = dotColor(cell?.rank ?? null);
        const label = cell?.rank == null ? "—" : cell.rank >= 30 ? "30+" : String(cell.rank);
        return `<div style="width:${dotPx}px;height:${dotPx}px;border-radius:50%;background:${c.bg};color:${c.text};display:flex;align-items:center;justify-content:center;font-size:${size > 7 ? 11 : 13}px;font-weight:800;">${label}</div>`;
      }).join("")}</div>`
    ).join("");

    return `<!DOCTYPE html><html><head><title>Geo Grid - ${cfg.keyword}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:#0f172a;color:#f1f5f9;}
.wrap{max-width:640px;margin:40px auto;background:#0f172a;border-radius:12px;overflow:hidden;}
.topbar{background:#1e293b;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;}
.client{color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;}
.date-label{color:#64748b;font-size:11px;}
.body{padding:20px;}
.kw-label{color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;}
.kw{color:#f1f5f9;font-size:26px;font-weight:900;margin-bottom:16px;}
.addr{color:#64748b;font-size:12px;margin-bottom:12px;}
.grid{display:inline-flex;flex-direction:column;gap:0;}
.legend{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;}
.ldot{width:11px;height:11px;border-radius:50%;display:inline-block;margin-right:3px;}
.footer{background:#1e293b;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:0;}
.fl{color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;}
.fr{color:#e2e8f0;font-size:12px;font-weight:700;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head>
<body><div class="wrap">
<div class="topbar"><span class="client">${clientName}</span><span class="date-label">${date}</span></div>
<div class="body">
  <div class="kw-label">Keyword</div>
  <div class="kw">${cfg.keyword}</div>
  ${cfg.centerAddress ? `<div class="addr">📍 ${cfg.centerAddress}</div>` : ""}
  <div class="grid">${gridHtml}</div>
  <div class="legend">
    ${LEGEND.map(l => `<span style="display:flex;align-items:center;font-size:11px;color:#94a3b8"><span class="ldot" style="background:${l.bg}"></span>${l.label}</span>`).join("")}
  </div>
</div>
<div class="footer"><span class="fl">LATEST RANK DATE</span><span class="fr">${date}</span></div>
</div><script>window.onload=()=>window.print()</script></body></html>`;
  }

  function handleDownloadPDF(cfg: GeoGridConfig) {
    const results: GeoGridResult[] = queryClient.getQueryData([`/api/geo-grids/${cfg.id}/results`]) ?? [];
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildPrintHTML(cfg, results));
    w.document.close();
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm">Geo-Grid Heatmap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Rank distribution across geographic locations</p>
        </div>
        <div className="flex gap-2">
          {configs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateAll}
              disabled={generatingAll}
            >
              {generatingAll
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Zap className="w-4 h-4 mr-2" />}
              Generate All ({configs.length})
            </Button>
          )}
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Grid
          </Button>
        </div>
      </div>

      {/* Grid cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border rounded-xl">
          <Map className="w-10 h-10 mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium">No grids yet</p>
          <p className="text-xs mt-1">Click "Add Grid" to create your first geo-grid heatmap</p>
        </div>
      ) : (
        <CardGrid
          configs={configs}
          clientName={clientName}
          selectedConfigId={selectedConfigId}
          generatingIds={generatingIds}
          onSelect={setSelectedConfigId}
          onGenerate={handleGenerate}
          onDelete={(id) => setDeleteTarget(id)}
          onDownloadPDF={handleDownloadPDF}
          queryClient={queryClient}
        />
      )}

      {/* Add Grid Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Geo-Grid Heatmap</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Keyword <span className="text-destructive">*</span></Label>
              <Input required placeholder="e.g. tummy tuck" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Campaign (optional)</Label>
              <Select value={form.campaignId} onValueChange={v => setForm(f => ({ ...f, campaignId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Business (optional)</Label>
              <Select value={form.businessId} onValueChange={v => setForm(f => ({ ...f, businessId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select business..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No business</SelectItem>
                  {businesses.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.businessName}</SelectItem>)}
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
                <Input placeholder="29.7604" value={form.centerLat} onChange={e => setForm(f => ({ ...f, centerLat: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Longitude <span className="text-destructive">*</span></Label>
                <Input placeholder="-95.3698" value={form.centerLng} onChange={e => setForm(f => ({ ...f, centerLng: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Radius (miles)</Label>
                <Select value={form.radiusMiles} onValueChange={v => setForm(f => ({ ...f, radiusMiles: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 5, 7, 10, 15, 20].map(r => <SelectItem key={r} value={String(r)}>{r} miles</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Grid Size</Label>
                <Select value={form.gridSize} onValueChange={v => setForm(f => ({ ...f, gridSize: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 9].map(s => <SelectItem key={s} value={String(s)}>{s}×{s} ({s * s} points)</SelectItem>)}
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

// Separate component so each card can independently subscribe to its results
function CardGrid({
  configs, clientName, selectedConfigId, generatingIds, onSelect, onGenerate, onDelete, onDownloadPDF, queryClient,
}: {
  configs: GeoGridConfig[];
  clientName: string;
  selectedConfigId: number | null;
  generatingIds: Set<number>;
  onSelect: (id: number) => void;
  onGenerate: (id: number) => void;
  onDelete: (id: number) => void;
  onDownloadPDF: (cfg: GeoGridConfig) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
      }}
    >
      {configs.map(cfg => (
        <CardGridItem
          key={cfg.id}
          config={cfg}
          clientName={clientName}
          isSelected={selectedConfigId === cfg.id}
          generating={generatingIds.has(cfg.id)}
          onSelect={() => onSelect(cfg.id)}
          onGenerate={() => onGenerate(cfg.id)}
          onDelete={() => onDelete(cfg.id)}
          onDownloadPDF={() => onDownloadPDF(cfg)}
        />
      ))}
    </div>
  );
}

function CardGridItem({
  config, clientName, isSelected, generating, onSelect, onGenerate, onDelete, onDownloadPDF,
}: {
  config: GeoGridConfig;
  clientName: string;
  isSelected: boolean;
  generating: boolean;
  onSelect: () => void;
  onGenerate: () => void;
  onDelete: () => void;
  onDownloadPDF: () => void;
}) {
  const { data: results = [] } = useQuery<GeoGridResult[]>({
    queryKey: [`/api/geo-grids/${config.id}/results`],
    queryFn: () => authFetch(`/api/geo-grids/${config.id}/results`),
    enabled: config.id > 0,
  });

  return (
    <ReportCard
      config={config}
      results={results}
      clientName={clientName}
      generating={generating}
      isSelected={isSelected}
      onClick={onSelect}
      onGenerate={onGenerate}
      onDelete={onDelete}
      onDownloadPDF={onDownloadPDF}
    />
  );
}
