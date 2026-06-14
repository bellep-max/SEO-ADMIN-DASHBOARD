import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetCampaign,
  useGetCampaignKeywords,
  useGetKeywordHistory,
  useCreateKeyword,
  getGetCampaignQueryKey,
  getGetCampaignKeywordsQueryKey,
  getGetKeywordHistoryQueryKey,
  getListKeywordsQueryKey,
  CampaignStatus,
  useUpdateCampaign,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowUp, ArrowDown, Minus, Plus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

function KeywordSparkline({ keywordId }: { keywordId: number }) {
  const { data: history } = useGetKeywordHistory(keywordId, { query: { enabled: !!keywordId, queryKey: getGetKeywordHistoryQueryKey(keywordId) } });
  if (!history || history.length === 0) return <div className="text-xs text-muted-foreground">—</div>;
  const validData = history.filter(h => h.rank !== null).map(h => ({ ...h, rank: h.rank as number })).reverse();
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={validData}>
          <YAxis domain={["auto", "auto"]} reversed hide />
          <Line type="monotone" dataKey="rank" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const campaignId = id ? parseInt(id) : 0;

  const { data: campaign, isLoading } = useGetCampaign(campaignId, { query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) } });
  const { data: keywords } = useGetCampaignKeywords(campaignId, { query: { enabled: !!campaignId, queryKey: getGetCampaignKeywordsQueryKey(campaignId) } });

  const updateCampaign = useUpdateCampaign();
  const createKeyword = useCreateKeyword();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isKeywordDialogOpen, setIsKeywordDialogOpen] = useState(false);
  const [keywordForm, setKeywordForm] = useState({
    keywordText: "",
    searchVolume: "",
    currentRank: "",
  });

  const handleStatusChange = (status: string) => {
    if (!campaign) return;
    updateCampaign.mutate({ id: campaignId, data: { status: status as CampaignStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        toast({ title: "Campaign status updated" });
      }
    });
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    createKeyword.mutate({
      data: {
        campaignId,
        keywordText: keywordForm.keywordText,
        searchVolume: keywordForm.searchVolume ? parseInt(keywordForm.searchVolume) : undefined,
        currentRank: keywordForm.currentRank ? parseInt(keywordForm.currentRank) : undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignKeywordsQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        setIsKeywordDialogOpen(false);
        setKeywordForm({ keywordText: "", searchVolume: "", currentRank: "" });
        toast({ title: "Keyword added", description: `"${keywordForm.keywordText}" is now being tracked.` });
      },
      onError: () => {
        toast({ title: "Failed to add keyword", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!campaign) return <div>Campaign not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge variant="outline">{campaign.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            Targeting: <span className="font-medium text-foreground">{campaign.targetDomain}</span>
            <span className="text-muted-foreground/50">•</span>
            <Link href={`/clients/${campaign.clientId}`} className="hover:text-primary hover:underline">
              {campaign.clientName}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isKeywordDialogOpen} onOpenChange={setIsKeywordDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Keyword</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Keyword to "{campaign.name}"</DialogTitle></DialogHeader>
              <form onSubmit={handleAddKeyword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Keyword</Label>
                  <Input
                    required
                    placeholder="e.g. best project management software"
                    value={keywordForm.keywordText}
                    onChange={e => setKeywordForm(p => ({ ...p, keywordText: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Monthly Search Volume</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5400"
                      value={keywordForm.searchVolume}
                      onChange={e => setKeywordForm(p => ({ ...p, searchVolume: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Rank</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 15"
                      value={keywordForm.currentRank}
                      onChange={e => setKeywordForm(p => ({ ...p, currentRank: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createKeyword.isPending}>
                  {createKeyword.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Keyword
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Select value={campaign.status} onValueChange={handleStatusChange} disabled={updateCampaign.isPending}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead>30d Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No keywords tracked. Add one above.
                </TableCell>
              </TableRow>
            ) : (
              keywords?.map(k => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.keywordText}</TableCell>
                  <TableCell className="text-right font-semibold">{k.currentRank || "—"}</TableCell>
                  <TableCell className="text-right">
                    {k.rankChange != null ? (
                      k.rankChange > 0 ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          <ArrowUp className="w-3 h-3 mr-1" /> {k.rankChange}
                        </Badge>
                      ) : k.rankChange < 0 ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          <ArrowDown className="w-3 h-3 mr-1" /> {Math.abs(k.rankChange)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground"><Minus className="w-3 h-3 inline" /></span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {k.searchVolume?.toLocaleString() || "—"}
                  </TableCell>
                  <TableCell>
                    <KeywordSparkline keywordId={k.id} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
