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
import { Loader2, Link2 } from "lucide-react";

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
      <DialogContent className="max-w-lg">
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
              <SelectTrigger id="akd-campaign" className={errors.campaignId ? "border-destructive" : ""}>
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
            <Label htmlFor="akd-text">Keyword <span className="text-destructive">*</span></Label>
            <Input
              id="akd-text"
              placeholder="e.g. best plumber in Manchester"
              value={form.keywordText}
              onChange={e => { setForm(f => ({ ...f, keywordText: e.target.value })); setErrors(e2 => ({ ...e2, keywordText: "" })); }}
              className={errors.keywordText ? "border-destructive" : ""}
            />
            {errors.keywordText && <p className="text-xs text-destructive">{errors.keywordText}</p>}
          </div>

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
