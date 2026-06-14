import { useState } from "react";
import { useListKeywords, useVerifyKeyword, useUnverifyKeyword, getListKeywordsQueryKey, useListCampaigns } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Zap, Shield, Activity } from "lucide-react";

export default function Falcon() {
  const [campaignId, setCampaignId] = useState<number | undefined>();
  const { data: keywords, isLoading } = useListKeywords({ campaignId });
  const { data: campaigns } = useListCampaigns();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const verifyKeyword = useVerifyKeyword();
  const unverifyKeyword = useUnverifyKeyword();

  const verifiedCount = keywords?.filter(k => k.isVerified).length ?? 0;
  const totalCount = keywords?.length ?? 0;
  const pendingCount = totalCount - verifiedCount;

  const handleVerify = (id: number, keyword: string) => {
    verifyKeyword.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast({
          title: "✅ Keyword Verified",
          description: `"${keyword}" has been verified by Falcon and is now active.`,
        });
      },
      onError: () => {
        toast({ title: "Verification failed", variant: "destructive" });
      }
    });
  };

  const handleUnverify = (id: number, keyword: string) => {
    unverifyKeyword.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
        toast({
          title: "Verification Removed",
          description: `"${keyword}" has been unverified.`,
          variant: "destructive",
        });
      }
    });
  };

  const handleVerifyAll = async () => {
    const unverified = keywords?.filter(k => !k.isVerified) ?? [];
    for (const kw of unverified) {
      await new Promise<void>((resolve) => {
        verifyKeyword.mutate({ id: kw.id }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
    toast({
      title: `🦅 Falcon Provisioning Complete`,
      description: `${unverified.length} keyword(s) verified successfully.`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Falcon</h1>
              <p className="text-muted-foreground mt-0.5">Keyword provisioning & verification API</p>
            </div>
          </div>
        </div>
        <Button onClick={handleVerifyAll} disabled={verifyKeyword.isPending || pendingCount === 0} className="gap-2">
          {verifyKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Verify All Pending
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Total Keywords
            </CardDescription>
            <CardTitle className="text-3xl">{totalCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-4 h-4" /> Verified
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{verifiedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0}% verified</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <Shield className="w-4 h-4" /> Pending Verification
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">{pendingCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting Falcon provisioning</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Select value={campaignId?.toString() || "all"} onValueChange={v => setCampaignId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filter by campaign" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified At</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : keywords?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No keywords to verify.</TableCell>
              </TableRow>
            ) : (
              keywords?.map(kw => (
                <TableRow key={kw.id} className={kw.isVerified ? "bg-green-500/5" : ""}>
                  <TableCell className="font-medium">{kw.keywordText}</TableCell>
                  <TableCell className="text-muted-foreground">{kw.campaignName}</TableCell>
                  <TableCell className="text-muted-foreground">{kw.clientName}</TableCell>
                  <TableCell className="text-right font-semibold">{kw.currentRank || "-"}</TableCell>
                  <TableCell>
                    {kw.isVerified ? (
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 gap-1">
                        <Shield className="w-3 h-3" /> Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {kw.verifiedAt ? new Date(kw.verifiedAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {kw.isVerified ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnverify(kw.id, kw.keywordText)} disabled={unverifyKeyword.isPending}>
                        <XCircle className="w-3 h-3 mr-1" /> Unverify
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleVerify(kw.id, kw.keywordText)} disabled={verifyKeyword.isPending}>
                        <Zap className="w-3 h-3 mr-1" /> Verify
                      </Button>
                    )}
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
