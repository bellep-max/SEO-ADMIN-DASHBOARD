import { useListKeywords, useListCampaigns } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle2, ArrowUp, ArrowDown, Minus, Loader2 } from "lucide-react";

export default function VerifiedKeywords() {
  const { data: allKeywords, isLoading } = useListKeywords({});
  const { data: campaigns } = useListCampaigns();

  const verified = allKeywords?.filter(k => k.isVerified) ?? [];

  const byClient = verified.reduce<Record<string, typeof verified>>((acc, kw) => {
    const key = kw.clientName ?? "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(kw);
    return acc;
  }, {});

  const avgRank = verified.length > 0
    ? Math.round(verified.filter(k => k.currentRank).reduce((s, k) => s + (k.currentRank ?? 0), 0) / verified.filter(k => k.currentRank).length)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Verified Keywords</h1>
              <p className="text-muted-foreground mt-0.5">Keywords confirmed through Falcon provisioning.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{verified.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRank ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clients Covered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(byClient).length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead>Verified On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : verified.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No verified keywords yet. Use <Link href="/falcon" className="text-primary hover:underline">Falcon</Link> to verify keywords.
                </TableCell>
              </TableRow>
            ) : (
              verified.map(kw => (
                <TableRow key={kw.id} className="group">
                  <TableCell className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    {kw.keywordText}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{kw.clientName}</TableCell>
                  <TableCell>
                    <Link href={`/campaigns/${kw.campaignId}`} className="text-muted-foreground hover:text-primary text-sm">
                      {kw.campaignName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{kw.currentRank ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {kw.rankChange != null ? (
                      kw.rankChange > 0 ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          <ArrowUp className="w-3 h-3 mr-1" /> {kw.rankChange}
                        </Badge>
                      ) : kw.rankChange < 0 ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          <ArrowDown className="w-3 h-3 mr-1" /> {Math.abs(kw.rankChange)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground"><Minus className="w-3 h-3 inline" /></span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {kw.searchVolume?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {kw.verifiedAt ? new Date(kw.verifiedAt).toLocaleDateString() : "—"}
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
