import { useState } from "react";
import { useListReports, useCreateReport, getListReportsQueryKey, useListClients, useListCampaigns } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Download, FileText } from "lucide-react";

export default function Reports() {
  const [clientId, setClientId] = useState<number | undefined>();
  const { data, isLoading } = useListReports({ clientId });
  const { data: clients } = useListClients();
  const { data: campaigns } = useListCampaigns({ clientId: clientId || undefined });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createReport = useCreateReport();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    campaignId: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReport.mutate({ 
      data: {
        clientId: parseInt(formData.clientId),
        campaignId: parseInt(formData.campaignId),
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setIsDialogOpen(false);
        setFormData({ clientId: "", campaignId: "" });
        toast({ title: "Report generated successfully" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate and view client SEO performance reports.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Generate Report</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate New Report</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={formData.clientId} onValueChange={v => setFormData(prev => ({ ...prev, clientId: v, campaignId: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campaign</Label>
                <Select value={formData.campaignId} onValueChange={v => setFormData(prev => ({ ...prev, campaignId: v }))} disabled={!formData.clientId}>
                  <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                  <SelectContent>
                    {campaigns?.filter(c => c.clientId.toString() === formData.clientId).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createReport.isPending || !formData.campaignId}>
                {createReport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate
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
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No reports generated yet.
                </TableCell>
              </TableRow>
            ) : (
              data?.map(report => (
                <TableRow key={report.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2 font-medium">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>{report.clientName}</TableCell>
                  <TableCell>{report.campaignName}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {report.summary || "Performance overview generated successfully."}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                      <Download className="w-4 h-4 mr-2" /> Download
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