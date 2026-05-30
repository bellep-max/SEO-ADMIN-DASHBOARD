import { useState } from "react";
import { Link } from "wouter";
import { useListKeywords, useDeleteKeyword, useRefreshKeywordRank, getListKeywordsQueryKey, useListCampaigns } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, ArrowUp, ArrowDown, Minus, CheckCircle2 } from "lucide-react";
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

export default function Keywords() {
  const [campaignId, setCampaignId] = useState<number | undefined>();
  const [tab, setTab] = useState("all");
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
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : displayData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {tab === "verified" ? "No verified keywords. Use Falcon to verify." : "No keywords found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayData?.map(keyword => (
                    <TableRow key={keyword.id} className={`group ${keyword.isVerified ? "bg-green-500/5" : ""}`}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {keyword.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        {keyword.keywordText}
                      </TableCell>
                      <TableCell>
                        <Link href={`/campaigns/${keyword.campaignId}`} className="text-muted-foreground hover:text-primary">
                          {keyword.campaignName}
                        </Link>
                        <div className="text-xs text-muted-foreground/70">{keyword.clientName}</div>
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
                        {keyword.isVerified ? (
                          <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-xs gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unverified</span>
                        )}
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
    </div>
  );
}
