import { useState } from "react";
import { Link } from "wouter";
import { useListKeywords, useDeleteKeyword, useRefreshKeywordRank, getListKeywordsQueryKey, useListCampaigns } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, ArrowUp, ArrowDown, Minus } from "lucide-react";

export default function Keywords() {
  const [campaignId, setCampaignId] = useState<number | undefined>();
  const { data, isLoading } = useListKeywords({ campaignId });
  const { data: campaigns } = useListCampaigns();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const deleteKeyword = useDeleteKeyword();
  const refreshRank = useRefreshKeywordRank();

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

      <div className="flex items-center space-x-4 max-w-md">
        <Select value={campaignId?.toString() || "all"} onValueChange={v => setCampaignId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger><SelectValue placeholder="Filter by campaign" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.clientName})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No keywords found.
                </TableCell>
              </TableRow>
            ) : (
              data?.map(keyword => (
                <TableRow key={keyword.id} className="group">
                  <TableCell className="font-medium">{keyword.keywordText}</TableCell>
                  <TableCell>
                    <Link href={`/campaigns/${keyword.campaignId}`} className="text-muted-foreground hover:text-primary">
                      {keyword.campaignName}
                    </Link>
                    <div className="text-xs text-muted-foreground/70">{keyword.clientName}</div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {keyword.currentRank || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {keyword.rankChange ? (
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
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {keyword.searchVolume?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleRefresh(keyword.id)} disabled={refreshRank.isPending} title="Refresh Rank">
                      <RefreshCw className={`w-4 h-4 text-muted-foreground hover:text-primary ${refreshRank.isPending ? 'animate-spin' : ''}`} />
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
    </div>
  );
}