import { useState } from "react";
import { Link } from "wouter";
import { useListCampaigns, useCreateCampaign, useDeleteCampaign, getListCampaignsQueryKey, useListClients, CampaignStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Filter } from "lucide-react";

export default function Campaigns() {
  const [clientId, setClientId] = useState<number | undefined>();
  const { data, isLoading } = useListCampaigns({ clientId });
  const { data: clients } = useListClients();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    targetDomain: "",
    targetLocation: "",
    targetLanguage: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaign.mutate({ 
      data: {
        ...formData,
        clientId: parseInt(formData.clientId),
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        setIsDialogOpen(false);
        setFormData({ clientId: "", name: "", targetDomain: "", targetLocation: "", targetLanguage: "" });
        toast({ title: "Campaign created" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure?")) {
      deleteCampaign.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({ title: "Campaign deleted" });
        }
      });
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20",
    paused: "bg-muted text-muted-foreground border-border",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage tracking campaigns across domains.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={formData.clientId} onValueChange={v => setFormData(prev => ({ ...prev, clientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input required value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Target Domain</Label>
                <Input required placeholder="example.com" value={formData.targetDomain} onChange={e => setFormData(prev => ({ ...prev, targetDomain: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location (Optional)</Label>
                  <Input value={formData.targetLocation} onChange={e => setFormData(prev => ({ ...prev, targetLocation: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Language (Optional)</Label>
                  <Input value={formData.targetLanguage} onChange={e => setFormData(prev => ({ ...prev, targetLanguage: e.target.value }))} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createCampaign.isPending || !formData.clientId}>
                {createCampaign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4 max-w-md">
        <div className="flex-1 flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={clientId?.toString() || "all"} onValueChange={v => setClientId(v === "all" ? undefined : parseInt(v))}>
            <SelectTrigger><SelectValue placeholder="Filter by client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Keywords</TableHead>
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
                  No campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              data?.map(campaign => (
                <TableRow key={campaign.id} className="group">
                  <TableCell>
                    <Link href={`/campaigns/${campaign.id}`} className="font-medium text-primary hover:underline">
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{campaign.clientName}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{campaign.targetDomain}</div>
                    {(campaign.targetLocation || campaign.targetLanguage) && (
                      <div className="text-xs text-muted-foreground">
                        {[campaign.targetLocation, campaign.targetLanguage].filter(Boolean).join(" / ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[campaign.status] || ""}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{campaign.keywordCount || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(campaign.id)} className="text-muted-foreground hover:text-destructive">
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