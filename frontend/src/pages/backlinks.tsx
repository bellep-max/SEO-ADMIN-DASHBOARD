import { useState } from "react";
import { useListBacklinks, useGetDisavowList, useDeleteBacklink, getListBacklinksQueryKey, useListClients, getGetDisavowListQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Download, ExternalLink, AlertTriangle } from "lucide-react";

export default function Backlinks() {
  const [clientId, setClientId] = useState<number | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const { data, isLoading } = useListBacklinks({ clientId, status });
  const { data: clients } = useListClients();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const deleteBacklink = useDeleteBacklink();
  const disavowParams = { clientId: clientId || 0 };
  const { refetch: fetchDisavow } = useGetDisavowList(disavowParams, { query: { enabled: false, queryKey: getGetDisavowListQueryKey(disavowParams) } });

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const confirmDelete = () => {
    if (deleteTarget == null) return;
    deleteBacklink.mutate({ id: deleteTarget }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBacklinksQueryKey() });
        toast({ title: "Backlink deleted" });
        setDeleteTarget(null);
      }
    });
  };

  const handleExportDisavow = async () => {
    if (!clientId) {
      toast({ title: "Select a client first", variant: "destructive" });
      return;
    }
    const res = await fetchDisavow();
    if (res.data) {
      const blob = new Blob([res.data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `disavow-${clientId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Backlinks</h1>
          <p className="text-muted-foreground mt-1">Monitor backlink profiles and toxic links.</p>
        </div>
        <Button onClick={handleExportDisavow} variant="secondary" disabled={!clientId}>
          <Download className="w-4 h-4 mr-2" /> Export Disavow List
        </Button>
      </div>

      <div className="flex items-center space-x-4 max-w-2xl">
        <Select value={clientId?.toString() || "all"} onValueChange={v => setClientId(v === "all" ? undefined : parseInt(v))}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filter by client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients?.clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={v => setStatus(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source URL</TableHead>
              <TableHead>Target URL</TableHead>
              <TableHead className="text-right">Authority</TableHead>
              <TableHead>Status</TableHead>
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
                  No backlinks found.
                </TableCell>
              </TableRow>
            ) : (
              data?.map(link => (
                <TableRow key={link.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-sm">
                      {link.isToxic && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                      <a href={link.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                        {link.sourceUrl}
                      </a>
                      <a href={link.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-sm mt-1">
                      Anchor: <span className="font-medium text-foreground/80">{link.anchorText || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[200px]" title={link.targetUrl}>
                    {link.targetUrl}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={link.authorityScore && link.authorityScore >= 50 ? "default" : "secondary"}>
                      {link.authorityScore || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      link.status === "new" ? "bg-green-500/10 text-green-600 border-green-500/20" : 
                      "bg-destructive/10 text-destructive border-destructive/20"
                    }>
                      {link.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(link.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete backlink?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}