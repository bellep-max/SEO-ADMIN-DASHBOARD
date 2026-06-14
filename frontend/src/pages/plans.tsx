import { useState } from "react";
import { useListPlans, useCreatePlan, useDeletePlan, getListPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function Plans() {
  const { data, isLoading } = useListPlans();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    keywordLimit: "",
    backlinkCheckLimit: "",
    auditLimit: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPlan.mutate({ 
      data: {
        name: formData.name,
        price: parseFloat(formData.price),
        keywordLimit: parseInt(formData.keywordLimit),
        backlinkCheckLimit: parseInt(formData.backlinkCheckLimit),
        auditLimit: formData.auditLimit ? parseInt(formData.auditLimit) : undefined
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
        setIsDialogOpen(false);
        setFormData({ name: "", price: "", keywordLimit: "", backlinkCheckLimit: "", auditLimit: "" });
        toast({ title: "Plan created" });
      }
    });
  };

  const confirmDelete = () => {
    if (deleteTarget == null) return;
    deletePlan.mutate({ id: deleteTarget }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
        toast({ title: "Plan deleted" });
        setDeleteTarget(null);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground mt-1">Manage subscription plans and limits.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Plan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Price ($)</Label>
                <Input type="number" step="0.01" required value={formData.price} onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Keyword Limit</Label>
                  <Input type="number" required value={formData.keywordLimit} onChange={e => setFormData(prev => ({ ...prev, keywordLimit: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Backlink Limit</Label>
                  <Input type="number" required value={formData.backlinkCheckLimit} onChange={e => setFormData(prev => ({ ...prev, backlinkCheckLimit: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Audit Limit (Optional)</Label>
                <Input type="number" value={formData.auditLimit} onChange={e => setFormData(prev => ({ ...prev, auditLimit: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={createPlan.isPending}>
                {createPlan.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Keywords</TableHead>
              <TableHead>Backlinks</TableHead>
              <TableHead>Audits</TableHead>
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
                  No plans found.
                </TableCell>
              </TableRow>
            ) : (
              data?.map(plan => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>${plan.price}</TableCell>
                  <TableCell>{plan.keywordLimit}</TableCell>
                  <TableCell>{plan.backlinkCheckLimit}</TableCell>
                  <TableCell>{plan.auditLimit || "Unlimited"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(plan.id)} className="text-muted-foreground hover:text-destructive">
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
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the plan and cannot be undone.</AlertDialogDescription>
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