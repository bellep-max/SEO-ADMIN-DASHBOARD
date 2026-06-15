import { useState } from "react";
import { useCreateKeyword, useCreateBacklink } from "@workspace/api-client-react";
import type { Campaign, Keyword } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2, Sparkles, Search, Check } from "lucide-react";

type KeywordIdea = {
  keyword: string;
  popularity: number | null;
  intent: string;
  commercialIntent: number;
  reasoning: string;
  aiSearch: boolean;
};

function authFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("seo_admin_token") ?? "";
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    return res.json();
  });
}

const INTENT_COLOR: Record<string, string> = {
  transactional: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  commercial: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  navigational: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  informational: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

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

type Props = {
  open: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  defaultCampaignId?: number;
  onCreated: () => void;
};

export function AddKeywordDialog({ open, onClose, campaigns, defaultCampaignId, onCreated }: Props) {
  const { toast } = useToast();
  const createKeyword = useCreateKeyword();
  const createBacklink = useCreateBacklink();

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    campaignId: defaultCampaignId?.toString() ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedCampaign = campaigns.find(c => c.id.toString() === form.campaignId);

  // --- keyword idea generation ---
  const [showIdeas, setShowIdeas] = useState(false);
  const [seed, setSeed] = useState("");
  const [ideaLoc, setIdeaLoc] = useState("");
  const [includeAi, setIncludeAi] = useState(false);
  const [finding, setFinding] = useState(false);
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const openIdeas = () => {
    setShowIdeas(true);
    if (!seed) setSeed(form.keywordText.trim() || selectedCampaign?.name || "");
    if (!ideaLoc) setIdeaLoc(selectedCampaign?.targetLocation ?? "");
  };

  const findIdeas = async () => {
    if (!seed.trim()) return;
    setFinding(true);
    setIdeas([]);
    setSelected(new Set());
    try {
      const r = await authFetch("/api/keywords/suggest", {
        method: "POST",
        body: JSON.stringify({ seed: seed.trim(), location: ideaLoc.trim(), maxIdeas: 25, includeAiSearch: includeAi }),
      });
      const merged: KeywordIdea[] = [...(r.ideas ?? []), ...(r.aiSearch ?? [])];
      setIdeas(merged);
      if (merged.length === 0) toast({ title: "No ideas found", description: "Try a broader seed term." });
      else if (!r.enriched) toast({ title: `${merged.length} ideas`, description: "AI labels off (no DeepSeek key)." });
    } catch (err) {
      toast({ title: "Couldn't fetch ideas", description: (err as Error).message, variant: "destructive" });
    } finally {
      setFinding(false);
    }
  };

  const toggleSel = (kw: string) =>
    setSelected(s => { const n = new Set(s); n.has(kw) ? n.delete(kw) : n.add(kw); return n; });

  const addSelected = async () => {
    if (!form.campaignId) { setErrors(e => ({ ...e, campaignId: "Select a campaign" })); return; }
    if (selected.size === 0) return;
    setAdding(true);
    try {
      await authFetch("/api/keywords/bulk", {
        method: "POST",
        body: JSON.stringify({ campaignId: parseInt(form.campaignId), keywords: [...selected] }),
      });
      toast({ title: `Added ${selected.size} keyword${selected.size > 1 ? "s" : ""}` });
      onCreated();
      handleClose();
    } catch (err) {
      toast({ title: "Failed to add keywords", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

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

  const reset = () => {
    setForm({ ...EMPTY_FORM, campaignId: defaultCampaignId?.toString() ?? "" });
    setErrors({});
    setShowIdeas(false); setSeed(""); setIdeaLoc(""); setIncludeAi(false);
    setIdeas([]); setSelected(new Set());
  };

  const handleClose = () => { reset(); onClose(); };

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
        onSuccess: (created) => {
          if (form.keywordType === "keywords_with_backlinks" && selectedCampaign) {
            createBacklink.mutate(
              {
                data: {
                  clientId: selectedCampaign.clientId,
                  keywordId: (created as Keyword).id,
                  linkTypeLabel: form.linkTypeLabel,
                  sourceUrl: form.linkUrl.trim(),
                  targetUrl: selectedCampaign.targetDomain
                    ? `https://${selectedCampaign.targetDomain.replace(/^https?:\/\//, "")}`
                    : "",
                  status: form.backlinkIsActive ? "new" : "lost",
                },
              },
              {
                onSuccess: () => { toast({ title: "Keyword + backlink added" }); onCreated(); handleClose(); },
                onError: () => toast({ title: "Keyword added, but backlink failed", variant: "destructive" }),
              }
            );
          } else {
            toast({ title: "Keyword added" });
            onCreated();
            handleClose();
          }
        },
        onError: (err: Error) =>
          toast({ title: "Failed to add keyword", description: err.message, variant: "destructive" }),
      }
    );
  };

  const isSubmitting = createKeyword.isPending || createBacklink.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Keyword</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="akd-campaign">Campaign <span className="text-destructive">*</span></Label>
            <Select
              value={form.campaignId}
              onValueChange={v => { setForm(f => ({ ...f, campaignId: v })); setErrors(e => ({ ...e, campaignId: "" })); }}
            >
              <SelectTrigger id="akd-campaign" className={`[&>span]:truncate ${errors.campaignId ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select a campaign…" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()} textValue={c.name}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium leading-tight">{c.name}</span>
                      {c.clientName && (
                        <span className="text-xs text-muted-foreground leading-tight">{c.clientName}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.campaignId && <p className="text-xs text-destructive">{errors.campaignId}</p>}
          </div>

          {selectedCampaign && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60">Selected Campaign</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Client</p>
                  <p className="font-medium text-foreground truncate">{selectedCampaign.clientName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Domain</p>
                  <p className="font-medium text-foreground truncate">{selectedCampaign.targetDomain || "—"}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="akd-text">Keyword <span className="text-destructive">*</span></Label>
            <Input
              id="akd-text"
              placeholder="e.g. best plumber in Manchester"
              value={form.keywordText}
              onChange={e => { setForm(f => ({ ...f, keywordText: e.target.value })); setErrors(e2 => ({ ...e2, keywordText: "" })); }}
              className={errors.keywordText ? "border-destructive" : ""}
            />
            {errors.keywordText && <p className="text-xs text-destructive">{errors.keywordText}</p>}
            {!showIdeas && (
              <button type="button" onClick={openIdeas}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <Sparkles className="w-3.5 h-3.5" /> Suggest keywords
              </button>
            )}
          </div>

          {showIdeas && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Keyword Ideas</span>
              </div>

              <div className="flex gap-2">
                <Input value={seed} onChange={e => setSeed(e.target.value)} placeholder="Seed, e.g. roofing contractor"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); findIdeas(); } }} className="flex-1" />
                <Input value={ideaLoc} onChange={e => setIdeaLoc(e.target.value)} placeholder="Location (optional)" className="w-40" />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Switch checked={includeAi} onCheckedChange={setIncludeAi} />
                  Include AI questions
                </label>
                <Button type="button" size="sm" onClick={findIdeas} disabled={finding || !seed.trim()}>
                  {finding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                  Find ideas
                </Button>
              </div>

              {ideas.length > 0 && (
                <>
                  <div className="max-h-64 overflow-y-auto rounded-md border bg-background divide-y">
                    {ideas.map(idea => {
                      const sel = selected.has(idea.keyword);
                      return (
                        <button type="button" key={idea.keyword} onClick={() => toggleSel(idea.keyword)}
                          className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 ${sel ? "bg-primary/5" : ""}`}>
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${sel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                            {sel && <Check className="w-3 h-3" />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{idea.keyword}</span>
                              {idea.aiSearch
                                ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">AI</span>
                                : <span className={`text-[10px] px-1.5 py-0.5 rounded ${INTENT_COLOR[idea.intent] ?? INTENT_COLOR.informational}`}>{idea.intent}</span>}
                              {idea.popularity != null && (
                                <span className="text-[10px] text-muted-foreground">pop {Math.round(idea.popularity * 100)}</span>
                              )}
                            </span>
                            {idea.reasoning && <span className="block text-[11px] text-muted-foreground mt-0.5">{idea.reasoning}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                    <Button type="button" size="sm" onClick={addSelected} disabled={adding || selected.size === 0}>
                      {adding && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                      Add {selected.size > 0 ? selected.size : ""} selected
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="akd-type">Keyword Types <span className="text-destructive">*</span></Label>
            <Select
              value={form.keywordType}
              onValueChange={v => setForm(f => ({ ...f, keywordType: v as typeof form.keywordType }))}
            >
              <SelectTrigger id="akd-type">
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
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
