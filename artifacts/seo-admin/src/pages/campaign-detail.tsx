import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetCampaign, 
  useGetCampaignKeywords, 
  useGetKeywordHistory,
  getGetCampaignQueryKey,
  CampaignStatus,
  useUpdateCampaign
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

function KeywordSparkline({ keywordId }: { keywordId: number }) {
  const { data: history } = useGetKeywordHistory(keywordId, { query: { enabled: !!keywordId } });
  
  if (!history || history.length === 0) return <div className="text-xs text-muted-foreground">-</div>;
  
  const validData = history.filter(h => h.rank !== null).map(h => ({ ...h, rank: h.rank as number })).reverse();
  
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={validData}>
          <YAxis domain={['auto', 'auto']} reversed hide />
          <Line type="monotone" dataKey="rank" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const campaignId = id ? parseInt(id) : 0;
  
  const { data: campaign, isLoading } = useGetCampaign(campaignId, { query: { enabled: !!campaignId } });
  const { data: keywords } = useGetCampaignKeywords(campaignId, { query: { enabled: !!campaignId } });
  
  const updateCampaign = useUpdateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleStatusChange = (status: string) => {
    if (!campaign) return;
    updateCampaign.mutate({ id: campaignId, data: { status: status as CampaignStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        toast({ title: "Campaign status updated" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

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
          <Select value={campaign.status} onValueChange={handleStatusChange} disabled={updateCampaign.isPending}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
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
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No keywords tracked.</TableCell></TableRow>
            ) : (
              keywords?.map(k => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.keywordText}</TableCell>
                  <TableCell className="text-right font-semibold">{k.currentRank || "-"}</TableCell>
                  <TableCell className="text-right">
                    {k.rankChange ? (
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
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {k.searchVolume?.toLocaleString() || "-"}
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