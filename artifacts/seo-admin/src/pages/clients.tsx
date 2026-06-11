import { useState } from "react";
import { Link } from "wouter";
import {
  useListClients,
  useCreateClient,
  useDeleteClient,
  getListClientsQueryKey,
  useListPlans,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search, Trash2, Building2 } from "lucide-react";

const SERVICE_CATEGORIES = [
  "Plumber", "Electrician", "Café", "Restaurant", "Dentist",
  "Lawyer", "HVAC", "Landscaping", "Cleaning", "Auto Repair",
  "Gym", "Salon", "Flooring", "Roofing", "Other",
];

const CREATED_BY_ROLES = ["Admin", "Manager", "Sales Rep", "Agent", "Client"];

function authFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("seo_admin_token") ?? "";
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    return res.json();
  });
}

const EMPTY_BIZ = {
  businessName: "",
  category: "",
  gmbUrl: "",
  website: "",
  address: "",
  zipCode: "",
  createdBy: "",
};

type Step = "create-client" | "prompt" | "add-business" | "closed";

export default function Clients() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListClients({ search });
  const { data: plans } = useListPlans();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();

  const [step, setStep] = useState<Step>("closed");
  const [newClientId, setNewClientId] = useState<number | null>(null);
  const [newClientName, setNewClientName] = useState("");

  const [formData, setFormData] = useState({
    name: "", email: "", company: "", websiteUrl: "", assignedPlanId: "",
  });
  const [bizForm, setBizForm] = useState(EMPTY_BIZ);

  const createBusiness = useMutation({
    mutationFn: (data: typeof EMPTY_BIZ & { clientId: number }) =>
      authFetch("/api/businesses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      setStep("closed");
      setBizForm(EMPTY_BIZ);
      toast({ title: "Business profile added successfully" });
    },
    onError: () => toast({ title: "Failed to create business", variant: "destructive" }),
  });

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClient.mutate(
      {
        data: {
          ...formData,
          assignedPlanId: formData.assignedPlanId
            ? parseInt(formData.assignedPlanId)
            : undefined,
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setNewClientId((created as { id: number }).id);
          setNewClientName(formData.name);
          setFormData({ name: "", email: "", company: "", websiteUrl: "", assignedPlanId: "" });
          setStep("prompt");
        },
      }
    );
  };

  const handleBizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) return;
    createBusiness.mutate({ ...bizForm, clientId: newClientId });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure?")) {
      deleteClient.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
            toast({ title: "Client deleted" });
          },
        }
      );
    }
  };

  const closeAll = () => {
    setStep("closed");
    setBizForm(EMPTY_BIZ);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your SEO clients and their assignments.
          </p>
        </div>
        <Button onClick={() => setStep("create-client")}>
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="flex items-center space-x-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
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
            ) : data?.clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              data?.clients.map((client) => (
                <TableRow key={client.id} className="group transition-colors">
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{client.email}</div>
                  </TableCell>
                  <TableCell>{client.company || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={client.status === "active" ? "default" : "secondary"}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{client.planName || "No plan"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(client.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Step 1: Create Client ── */}
      <Dialog open={step === "create-client"} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleClientSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input
                type="url"
                value={formData.websiteUrl}
                onChange={(e) => setFormData((p) => ({ ...p, websiteUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={formData.assignedPlanId}
                onValueChange={(v) => setFormData((p) => ({ ...p, assignedPlanId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createClient.isPending}>
              {createClient.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Client
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Step 2: Prompt ── */}
      <Dialog open={step === "prompt"} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent aria-describedby={undefined} className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Add Business Profile?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Would you like to add a Google Business (GMB) profile for{" "}
            <span className="font-semibold text-foreground">{newClientName}</span>?
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              className="flex-1"
              onClick={() => setStep("add-business")}
            >
              Yes, Add Business
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                toast({ title: `Client "${newClientName}" created` });
                closeAll();
              }}
            >
              No, Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Step 3: Add Business Form ── */}
      <Dialog open={step === "add-business"} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Add Business
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBizSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>
                Business Name <span className="text-destructive">*</span>
              </Label>
              <Input
                required
                value={bizForm.businessName}
                onChange={(e) =>
                  setBizForm((p) => ({ ...p, businessName: e.target.value }))
                }
                placeholder="Joe's Plumbing"
              />
            </div>

            <div className="space-y-2">
              <Label>Service Category</Label>
              <Select
                value={bizForm.category}
                onValueChange={(v) => setBizForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>GMB URL</Label>
              <Input
                value={bizForm.gmbUrl}
                onChange={(e) =>
                  setBizForm((p) => ({ ...p, gmbUrl: e.target.value }))
                }
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={bizForm.website}
                onChange={(e) =>
                  setBizForm((p) => ({ ...p, website: e.target.value }))
                }
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Published (GMB) Address</Label>
              <Input
                value={bizForm.address}
                onChange={(e) =>
                  setBizForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="123 Main St, New York, NY"
              />
            </div>

            <div className="space-y-2">
              <Label>Zip Code</Label>
              <Input
                value={bizForm.zipCode}
                onChange={(e) =>
                  setBizForm((p) => ({ ...p, zipCode: e.target.value }))
                }
                placeholder="10001"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Created By <span className="text-destructive">*</span>
              </Label>
              <Select
                value={bizForm.createdBy}
                onValueChange={(v) => setBizForm((p) => ({ ...p, createdBy: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {CREATED_BY_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                type="submit"
                className="flex-1"
                disabled={createBusiness.isPending || !bizForm.createdBy}
              >
                {createBusiness.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save Business
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("prompt")}
              >
                Back
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
