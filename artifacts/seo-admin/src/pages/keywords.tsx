import { useState } from "react";
import { Link } from "wouter";
import {
  useListKeywords, useDeleteKeyword, useRefreshKeywordRank, getListKeywordsQueryKey,
  useListCampaigns, useCreateKeyword, useCreateBacklink,
} from "@workspace/api-client-react";
import type { Keyword, Campaign } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, ArrowUp, ArrowDown, Minus, CheckCircle2, Plus, Link2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const RANK_BANDS = [
  { label: "Top 3", min: 1, max: 3 },
  { label: "4–10", min: 4, max: 10 },
  { label: "11–20", min: 11, max: 20 },
  { label: "21–50", min: 21, max: 50 },
  { label: "51+", min: 51, max: Infinity },
  { label: "Unranked", min: -1, max: -1 },
];

const VOLUME_BANDS = [
  { label: "0–1K", min: 0, max: 1000 },
  { label: "1K–5K", min: 1000, max: 5000 },
  { label: "5K–20K", min: 5000, max: 20000 },
  { label: "20K+", min: 20000, max: Infinity },
];

const LINK_TYPE_OPTIONS = [
  "Guest Post",
  "Directory",
  "Citation",
  "Press Release",
  "Blog Comment",
  "Forum",
  "Social Profile",
  "Resource Page",
  "Infographic",
  "Sponsored",
];

function getHeatColor(count: number, max: number) {
  if (max === 0 || count === 0) return "bg-muted/30 text-muted-foreground";
  const intensity = count / max;
  if (intensity >= 0.75) return "bg-primary text-primary-foreground font-bold";
  if (intensity >= 0.5) return "bg-primary/60 text-primary-foreground font-semibold";
  if (intensity >= 0.25) return "bg-primary/30 text-foreground";
  return "bg-primary/10 text-foreground";
}

function KeywordHeatMap({ keywords }: { keywords: { currentRank?: number | null; searchVolume?: number | null }[] }) {
  const matrix: number[][] = RANK_BANDS.map(() => VOLUME_BANDS.map(() => 0));

  keywords.forEach(kw => {
    const rank = kw.currentRank;
    const volume = kw.searchVolume;
    const ri = rank == null
      ? RANK_BANDS.length - 1
      : RANK_BANDS.findIndex(b => b.min !== -1 && rank >= b.min && rank <= b.max);
    const vi = volume == null
      ? 0
      : VOLUME_BANDS.findIndex(b => volume >= b.min && volume < b.max);
    if (ri >= 0 && vi >= 0) matrix[ri][vi]++;
  });

  const maxCount = Math.max(...matrix.flat());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Keyword Rank × Volume Heat Map</CardTitle>
        <p className="text-xs text-muted-foreground">Distribution of keywords by rank position and search volume</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-1 pr-4 text-muted-foreground font-medium w-24">Rank \ Volume</th>
                {VOLUME_BANDS.map(vb => (
                  <th key={vb.label} className="text-center py-1 px-2 text-muted-foreground font-medium">{vb.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RANK_BANDS.map((rb, ri) => (
                <tr key={rb.label}>
                  <td className="py-1 pr-4 text-muted-foreground font-medium">{rb.label}</td>
                  {VOLUME_BANDS.map((vb, vi) => {
                    const count = matrix[ri][vi];
                    return (
                      <Tooltip key={vb.label}>
                        <TooltipTrigger asChild>
                          <td className={`text-center py-2 px-3 rounded cursor-default transition-colors ${getHeatColor(count, maxCount)}`}>
                            {count > 0 ? count : "·"}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{count} keyword{count !== 1 ? "s" : ""}<br />Rank: {rb.label} · Volume: {vb.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">Intensity:</span>
          {["bg-muted/30", "bg-primary/10", "bg-primary/30", "bg-primary/60", "bg-primary"].map((cls, i) => (
            <div key={i} className={`h-3 w-8 rounded ${cls} border border-border/40`} />
          ))}
          <span className="text-xs text-muted-foreground">Low → High</span>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_FORM = {
  campaignId: "",
  keywordText: "",
  keywordType: "keywords" as "keywords" | "keywords_with_backlinks",
  isPrimary: false,
  isActive: true,
  linkUrl: "",
  linkTypeLabel: "",
  backlinkIsActive: true,
};

function AddKeywordDialog({
  open,
  onClose,
  campaigns,
  defaultCampaignId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  defaultCampaignId?: number;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const createKeyword = useCreateKeyword();
  const createBacklink = useCreateBacklink();

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    campaignId: defaultCampaignId?.toString() ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedCampaign = campaigns.find(c => c.id.toString() === form.campaignId);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.campaignId) errs.campaignId = "Select a campaign";
    if (!form.keywordText.trim()) errs.keywordText = "Keyword is required";
    if (form.keywordType === "keywords_with_backlinks") {
      if (!form.linkUrl.trim()) errs.linkUrl = "Link URL is required";
      if (!form.linkTypeLabel) errs.linkTypeLabel = "Select a link type";
    }
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    createKeyword.mutate(
      {
        data: {
          campaignId: parseInt(form.campaignId),
          keywordText: form.keywordText.trim(),
          keywordType: form.keywordType,
          isPrimary: form.isPrimary,
          isActive: form.isActive,
        },
      },
      {
        onSuccess: (createdKeyword) => {
          if (form.keywordType === "keywords_with_backlinks" && selectedCampaign) {
            createBacklink.mutate(
              {
                data: {
                  clientId: selectedCampaign.clientId,
                  keywordId: (createdKeyword as Keyword).id,
                  linkTypeLabel: form.linkTypeLabel,
                  sourceUrl: form.linkUrl.trim(),
                  targetUrl: selectedCampaign.targetDomain
                    ? `https://${selectedCampaign.targetDomain.replace(/^https?:\/\//, "")}`
                    : "",
                  status: form.backlinkIsActive ? "new" : "lost",
                },
              },
              {
                onSuccess: () => {
                  toast({ title: "Keyword + backlink added" });
                  onCreated();
                  onClose();
                  setForm({ ...EMPTY_FORM, campaignId: defaultCampaignId?.toString() ?? "" });
                },
                onError: () => toast({ title: "Keyword added, but backlink failed", variant: "destructive" }),
              }
            );
          } else {
            toast({ title: "Keyword added" });
            onCreated();
            onClose();
            setForm({ ...EMPTY_FORM, campaignId: defaultCampaignId?.toString() ?? "" });
          }
        },
        onError: (err: Error) => toast({ title: "Failed to add keyword", description: err.message, variant: "destructive" }),
      }
    );
  };

  const isSubmitting = createKeyword.isPending || createBacklink.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Keyword</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="kw-campaign">Campaign <span className="text-destructive">*</span></Label>
            <Select
              value={form.campaignId}
              onValueChange={v => { setForm(f => ({ ...f, campaignId: v })); setErrors(e => ({ ...e, campaignId: "" })); }}
            >
              <SelectTrigger id="kw-campaign" className={errors.campaignId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a campaign…" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.clientName} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.campaignId && <p className="text-xs text-destructive">{errors.campaignId}</p>}
          </div>

          {selectedCampaign && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="grid grid-cols-2 gap-x-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Client</p>
                  <p className="font-medium text-foreground">{selectedCampaign.clientName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Domain</p>
                  <p className="font-medium text-foreground">{selectedCampaign.targetDomain}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-0.5">Campaign</p>
                <p className="font-medium text-foreground">{selectedCampaign.name}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="kw-text">Keyword <span className="text-destructive">*</span></Label>
            <Input
              id="kw-text"
              placeholder="e.g. best plumber in Manchester"
              value={form.keywordText}
              onChange={e => { setForm(f => ({ ...f, keywordText: e.target.value })); setErrors(e2 => ({ ...e2, keywordText: "" })); }}
              className={errors.keywordText ? "border-destructive" : ""}
            />
            {errors.keywordText && <p className="text-xs text-destructive">{errors.keywordText}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="kw-type">Keyword Types <span className="text-destructive">*</span></Label>
            <Select
              value={form.keywordType}
              onValueChange={v => setForm(f => ({ ...f, keywordType: v as typeof form.keywordType }))}
            >
              <SelectTrigger id="kw-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keywords">Keywords</SelectItem>
                <SelectItem value="keywords_with_backlinks">Keywords with Backlinks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.keywordType === "keywords_with_backlinks" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Link2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Backlink Details</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link URL</Label>
                <Input
                  placeholder="https://…"
                  value={form.linkUrl}
                  onChange={e => { setForm(f => ({ ...f, linkUrl: e.target.value })); setErrors(e2 => ({ ...e2, linkUrl: "" })); }}
                  className={errors.linkUrl ? "border-destructive" : ""}
                />
                {errors.linkUrl && <p className="text-xs text-destructive">{errors.linkUrl}</p>}
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link Type Label</Label>
                  <Select
                    value={form.linkTypeLabel}
                    onValueChange={v => { setForm(f => ({ ...f, linkTypeLabel: v })); setErrors(e => ({ ...e, linkTypeLabel: "" })); }}
                  >
                    <SelectTrigger className={errors.linkTypeLabel ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select link type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {LINK_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.linkTypeLabel && <p className="text-xs text-destructive">{errors.linkTypeLabel}</p>}
                </div>

                <div className="flex flex-col items-center justify-center rounded-lg border bg-background px-4 py-2.5 gap-1 min-w-[90px]">
                  <span className="text-xs font-semibold">Active</span>
                  <Switch
                    checked={form.backlinkIsActive}
                    onCheckedChange={v => setForm(f => ({ ...f, backlinkIsActive: v }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Primary (1st)</p>
                <p className="text-xs text-muted-foreground">Mark as primary keyword</p>
              </div>
              <Switch
                checked={form.isPrimary}
                onCheckedChange={v => setForm(f => ({ ...f, isPrimary: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Active</p>
                <p className="text-xs text-muted-foreground">Include in campaigns</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Keyword
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Keywords() {
  const [campaignId, setCampaignId] = useState<number | undefined>();
  const [tab, setTab] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const { data, isLoading } = useListKeywords({ campaignId });
  const { data: campaigns } = useListCampaigns();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteKeyword = useDeleteKeyword();
  const refreshRank = useRefreshKeywordRank();

  const displayData = tab === "verified" ? data?.filter(k => k.isVerified) : data;

  const handleDelete = (id: number) => {
    if (confirm("Are you sure?")) {
      deleteKeyword.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
          toast({ title: "Keyword deleted" });
        }
      });
    }
  };

  const handleRefresh = (id: number) => {
    refreshRank.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast({ title: "Rank refreshed" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Keywords</h1>
          <p className="text-muted-foreground mt-1">Tracked keywords across all campaigns.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Keyword
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={campaignId?.toString() || "all"} onValueChange={v => setCampaignId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filter by campaign" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.clientName})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {data && data.length > 0 && <KeywordHeatMap keywords={data} />}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All Keywords ({data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="verified" className="gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Verified ({data?.filter(k => k.isVerified).length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          <div className="border rounded-md bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : displayData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {tab === "verified" ? "No verified keywords. Use Falcon to verify." : "No keywords yet. Click Add Keyword to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayData?.map(keyword => (
                    <TableRow key={keyword.id} className={`group ${keyword.isVerified ? "bg-green-500/5" : ""}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {keyword.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                          {keyword.keywordText}
                          {keyword.isPrimary && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">1st</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/campaigns/${keyword.campaignId}`} className="text-muted-foreground hover:text-primary">
                          {keyword.campaignName}
                        </Link>
                        <div className="text-xs text-muted-foreground/70">{keyword.clientName}</div>
                      </TableCell>
                      <TableCell>
                        {keyword.keywordType === "keywords_with_backlinks" ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <Link2 className="w-3 h-3" /> +Backlink
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Keyword</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{keyword.currentRank || "—"}</TableCell>
                      <TableCell className="text-right">
                        {keyword.rankChange != null ? (
                          keyword.rankChange > 0 ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              <ArrowUp className="w-3 h-3 mr-1" /> {keyword.rankChange}
                            </Badge>
                          ) : keyword.rankChange < 0 ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                              <ArrowDown className="w-3 h-3 mr-1" /> {Math.abs(keyword.rankChange)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground"><Minus className="w-3 h-3 inline" /></span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {keyword.searchVolume?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {keyword.isVerified ? (
                            <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-xs gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unverified</span>
                          )}
                          {!keyword.isActive && (
                            <span className="text-[10px] text-muted-foreground/60">Inactive</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleRefresh(keyword.id)} disabled={refreshRank.isPending} title="Refresh Rank">
                          <RefreshCw className={`w-4 h-4 text-muted-foreground hover:text-primary ${refreshRank.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(keyword.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <AddKeywordDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        campaigns={campaigns ?? []}
        defaultCampaignId={campaignId}
        onCreated={() => queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() })}
      />
    </div>
  );
}
