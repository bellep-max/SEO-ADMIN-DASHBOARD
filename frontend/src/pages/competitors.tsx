import { useState } from "react";
import { useListCompetitors, useCreateCompetitor, useDeleteCompetitor, getListCompetitorsQueryKey, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Filter } from "lucide-react";

export default function Competitors() {
  const [clientId, setClientId] = useState<number | undefined>();
  const { data, isLoading } = useListCompetitors({ clientId });
  const { data: clients } = useListClients();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createCompetitor = useCreateCompetitor();
  const deleteCompetitor = useDeleteCompetitor();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    domain: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCompetitor.mutate({ 
      data: {
        clientId: parseInt(formData.clientId),
        domain: formData.domain,
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCompetitorsQueryKey() });
        setIsDialogOpen(false);
        setFormData({ clientId: "", domain: "" });
        toast({ title: "Competitor tracked" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure?")) {
      deleteCompetitor.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCompetitorsQueryKey() });
          toast({ title: "Competitor removed" });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competitors</h1>
          <p className="text-muted-foreground mt-1">Track competitor domains against your clients.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Competitor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Track Competitor</DialogTitle>
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
                <Label>Competitor Domain</Label>
                <Input required placeholder="competitor.com" value={formData.domain} onChange={e => setFormData(prev => ({ ...prev, domain: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={createCompetitor.isPending || !formData.clientId}>
                {createCompetitor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Track
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4 max-w-sm">
        <Select value={clientId?.toString() || "all"} onValueChange={v => setClientId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger><SelectValue placeholder="Filter by client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients?.clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Backlinks</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No competitors tracked.
                </TableCell>
              </TableRow>
            ) : (
              data?.map(competitor => (
                <TableRow key={competitor.id}>
                  <TableCell className="font-medium text-primary">{competitor.domain}</TableCell>
                  <TableCell>
                    {clients?.clients.find(c => c.id === competitor.clientId)?.name || "Unknown Client"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {competitor.backlinkCount?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(competitor.id)} className="text-muted-foreground hover:text-destructive">
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