import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetClient, 
  useUpdateClient, 
  useGetClientCampaigns, 
  useGetClientKeywords, 
  useGetClientBacklinks,
  useListPlans,
  getGetClientQueryKey,
  ClientStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, ArrowUp, ArrowDown, Minus } from "lucide-react";

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = id ? parseInt(id) : 0;
  
  const { data: client, isLoading } = useGetClient(clientId, { query: { enabled: !!clientId } });
  const { data: campaigns } = useGetClientCampaigns(clientId, { query: { enabled: !!clientId } });
  const { data: keywords } = useGetClientKeywords(clientId, { query: { enabled: !!clientId } });
  const { data: backlinks } = useGetClientBacklinks(clientId, { query: { enabled: !!clientId } });
  const { data: plans } = useListPlans();
  
  const updateClient = useUpdateClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleStatusToggle = () => {
    if (!client) return;
    const newStatus = client.status === "active" ? "inactive" : "active";
    updateClient.mutate({ id: clientId, data: { status: newStatus as ClientStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        toast({ title: `Client marked as ${newStatus}` });
      }
    });
  };

  const handlePlanChange = (planId: string) => {
    if (!client) return;
    updateClient.mutate({ id: clientId, data: { assignedPlanId: planId === "none" ? null : parseInt(planId) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        toast({ title: "Plan updated" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!client) {
    return <div>Client not found</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <Badge variant={client.status === "active" ? "default" : "secondary"}>
              {client.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            {client.company || "No company"} • {client.email}
            {client.websiteUrl && (
              <a href={client.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline ml-2">
                <ExternalLink className="w-3 h-3 mr-1" /> Visit Site
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={client.assignedPlanId?.toString() || "none"} onValueChange={handlePlanChange} disabled={updateClient.isPending}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Assign plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Plan</SelectItem>
              {plans?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleStatusToggle} disabled={updateClient.isPending}>
            {updateClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {client.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns ({campaigns?.length || 0})</TabsTrigger>
          <TabsTrigger value="keywords">Keywords ({keywords?.length || 0})</TabsTrigger>
          <TabsTrigger value="backlinks">Backlinks ({backlinks?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaigns?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tracked Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keywords?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Backlinks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{backlinks?.length || 0}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Keywords</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No campaigns found.</TableCell></TableRow>
                ) : (
                  campaigns?.map(c => (
                    <TableRow key={c.id}>
                      <TableCell><Link href={`/campaigns/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></TableCell>
                      <TableCell>{c.targetDomain}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell className="text-right">{c.keywordCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No keywords found.</TableCell></TableRow>
                ) : (
                  keywords?.map(k => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.keywordText}</TableCell>
                      <TableCell>{k.campaignName}</TableCell>
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="backlinks" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Authority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlinks?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No backlinks found.</TableCell></TableRow>
                ) : (
                  backlinks?.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{b.sourceUrl}</a>
                      </TableCell>
                      <TableCell className="text-right">{b.authorityScore || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}