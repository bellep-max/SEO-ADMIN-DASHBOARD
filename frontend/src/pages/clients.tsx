import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Search, Trash2, Building2, Megaphone,
  FileText, Pencil, MapPin,
} from "lucide-react";

const SERVICE_CATEGORIES = [
  "Plumber", "Electrician", "Café", "Restaurant", "Dentist",
  "Lawyer", "HVAC", "Landscaping", "Cleaning", "Auto Repair",
  "Gym", "Salon", "Flooring", "Roofing", "Other",
];
const CREATED_BY_ROLES = ["Admin", "Manager", "Sales Rep", "Agent", "Client"];
const PLAN_TYPES = ["Basic", "Standard", "Premium", "Enterprise", "Custom"];
const ACCOUNT_TYPES = ["Agency", "Retail", "Personal Business Account"];

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
  businessName: "", category: "", gmbUrl: "",
  website: "", address: "", zipCode: "", createdBy: "",
};
const EMPTY_CAMPAIGN = {
  name: "", searchAddress: "", planType: "", createdBy: "",
  subscriptionId: "", cardLast4: "", startDate: "", nextBillingDate: "",
};
const EMPTY_CLIENT = {
  name: "", email: "", company: "", phone: "", websiteUrl: "",
  assignedPlanId: "", status: "active", accountType: "",
  accountUser: "", accountUserName: "", contactBillingEmail: "", createdBy: "",
};

type Step =
  | "closed"
  | "create-client"
  | "prompt-business"
  | "add-business"
  | "prompt-campaign"
  | "add-campaign";

type FieldErrors = Partial<Record<string, string>>;

/* ── Status Toggle ── */
function StatusToggle({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? "bg-green-500" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-lg transition-transform ${
            active ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </button>
      <span className={`text-xs font-medium ${active ? "text-green-600" : "text-muted-foreground"}`}>
        {active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

export default function Clients() {
  const [, navigate] = useLocation();

  // filters
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListClients({
    search: search || undefined,
    status: filterStatus || undefined,
    plan: filterPlan || undefined,
    type: filterType || undefined,
    page,
    limit: 20,
  });
  const { data: plans } = useListPlans();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();

  // modal flow
  const [step, setStep] = useState<Step>("closed");
  const [newClientId, setNewClientId] = useState<number | null>(null);
  const [newClientName, setNewClientName] = useState("");

  // form state
  const [formData, setFormData] = useState(EMPTY_CLIENT);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [bizForm, setBizForm] = useState(EMPTY_BIZ);
  const [bizErrors, setBizErrors] = useState<FieldErrors>({});
  const [campForm, setCampForm] = useState(EMPTY_CAMPAIGN);
  const [campErrors, setCampErrors] = useState<FieldErrors>({});

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const totalClients = data?.total ?? 0;
  const totalPages = Math.ceil(totalClients / 20) || 1;
  const hasFilters = !!(search || filterStatus || filterPlan || filterType || filterLocation);

  /* ── business creation ── */
  const createBusiness = useMutation({
    mutationFn: (data: typeof EMPTY_BIZ & { clientId: number }) =>
      authFetch("/api/businesses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      setCampForm((p) => ({
        ...p,
        name: [vars.businessName, vars.address].filter(Boolean).join(", "),
        searchAddress: vars.address,
      }));
      setStep("prompt-campaign");
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create business", description: err.message, variant: "destructive" }),
  });

  /* ── campaign creation ── */
  const createCampaign = useMutation({
    mutationFn: (data: typeof EMPTY_CAMPAIGN & { clientId: number }) =>
      authFetch("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      closeAll();
      toast({ title: "Campaign created successfully" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create campaign", description: err.message, variant: "destructive" }),
  });

  /* ── validate ── */
  function validateClient() {
    const errs: FieldErrors = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    if (!formData.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = "Enter a valid email address";
    if (!formData.createdBy) errs.createdBy = "Please select a role";
    return errs;
  }
  function validateBiz() {
    const errs: FieldErrors = {};
    if (!bizForm.businessName.trim()) errs.businessName = "Business name is required";
    if (!bizForm.createdBy) errs.createdBy = "Please select a role";
    return errs;
  }
  function validateCamp() {
    const errs: FieldErrors = {};
    if (!campForm.name.trim()) errs.name = "Campaign name is required";
    if (!campForm.planType) errs.planType = "Please select a plan type";
    if (!campForm.createdBy) errs.createdBy = "Please select a role";
    if (campForm.cardLast4 && !/^\d{4}$/.test(campForm.cardLast4))
      errs.cardLast4 = "Must be exactly 4 digits";
    return errs;
  }

  /* ── handlers ── */
  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateClient();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    createClient.mutate(
      {
        data: {
          name: formData.name,
          email: formData.email,
          company: formData.company || undefined,
          phone: formData.phone || undefined,
          websiteUrl: formData.websiteUrl || undefined,
          assignedPlanId: formData.assignedPlanId ? parseInt(formData.assignedPlanId) : undefined,
          status: (formData.status as "active" | "inactive") || "active",
          accountType: formData.accountType || undefined,
          accountUser: formData.accountUser || undefined,
          accountUserName: formData.accountUserName || undefined,
          contactBillingEmail: formData.contactBillingEmail || undefined,
          createdBy: formData.createdBy || undefined,
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setNewClientId((created as { id: number }).id);
          setNewClientName(formData.name);
          setFormData(EMPTY_CLIENT);
          setStep("prompt-business");
        },
        onError: (err: Error) =>
          toast({ title: "Failed to create client", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleBizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateBiz();
    if (Object.keys(errs).length) { setBizErrors(errs); return; }
    setBizErrors({});
    if (!newClientId) return;
    createBusiness.mutate({ ...bizForm, clientId: newClientId });
  };

  const handleCampSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCamp();
    if (Object.keys(errs).length) { setCampErrors(errs); return; }
    setCampErrors({});
    if (!newClientId) return;
    createCampaign.mutate({ ...campForm, clientId: newClientId });
  };

  const handleToggleStatus = (client: { id: number; status: string; name: string }) => {
    const next = client.status === "active" ? "inactive" : "active";
    updateClient.mutate(
      { id: client.id, data: { status: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: `${client.name} marked as ${next}` });
        },
        onError: () =>
          toast({ title: "Failed to update status", variant: "destructive" }),
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteClient.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: `"${deleteTarget.name}" deleted` });
          setDeleteTarget(null);
        },
        onError: () => {
          toast({ title: "Failed to delete client", variant: "destructive" });
          setDeleteTarget(null);
        },
      }
    );
  };

  const closeAll = () => {
    setStep("closed");
    setBizForm(EMPTY_BIZ);
    setBizErrors({});
    setCampForm(EMPTY_CAMPAIGN);
    setCampErrors({});
  };

  const clearFilters = () => {
    setSearch("");
    setFilterLocation("");
    setFilterStatus("");
    setFilterPlan("");
    setFilterType("");
    setPage(1);
  };

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;

  return (
    <TooltipProvider>
      <div className="space-y-5 animate-in fade-in duration-500">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Client List</p>
        </div>

        {/* ── Add Client Button (full width) ── */}
        <Button
          className="w-full h-11 text-base font-semibold"
          onClick={() => { setFormData(EMPTY_CLIENT); setFormErrors({}); setStep("create-client"); }}
        >
          <Plus className="w-5 h-5 mr-2" /> Add Client
        </Button>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Client name..."
              className="pl-8 w-44"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Location..."
              className="pl-8 w-40"
              value={filterLocation}
              onChange={(e) => { setFilterLocation(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={filterType || "all"} onValueChange={v => { setFilterType(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus || "all"} onValueChange={v => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Active" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPlan || "all"} onValueChange={v => { setFilterPlan(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Plans" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              {plans?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Client Name</TableHead>
                <TableHead className="font-semibold text-foreground">Businesses</TableHead>
                <TableHead className="font-semibold text-foreground">Campaigns</TableHead>
                <TableHead className="font-semibold text-foreground">Account Type</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : data?.clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No clients found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.clients.map((client) => {
                  const bizCount = (client as any).businessCount ?? 0;
                  const campCount = (client as any).campaignCount ?? 0;
                  return (
                    <TableRow key={client.id} className="group hover:bg-muted/30 transition-colors">
                      {/* Client Name */}
                      <TableCell>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {client.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{client.email}</div>
                      </TableCell>

                      {/* Businesses */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 font-medium"
                        >
                          <Building2 className="w-3 h-3 mr-1" />
                          {bizCount} {bizCount === 1 ? "business" : "businesses"}
                        </Badge>
                      </TableCell>

                      {/* Campaigns */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 font-medium"
                        >
                          <Megaphone className="w-3 h-3 mr-1" />
                          {campCount} {campCount === 1 ? "campaign" : "campaigns"}
                        </Badge>
                      </TableCell>

                      {/* Account Type */}
                      <TableCell>
                        {(client as any).accountType ? (
                          <Badge variant="secondary">{(client as any).accountType}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Status Toggle */}
                      <TableCell>
                        <StatusToggle
                          active={client.status === "active"}
                          onClick={() => handleToggleStatus(client)}
                          disabled={updateClient.isPending}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(`/clients/${client.id}`)}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">View details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(`/clients/${client.id}`)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Edit client</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget({ id: client.id, name: client.name })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Delete client</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalClients} client{totalClients !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span className="font-medium text-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {/* ── Delete Confirmation ── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete client?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>{" "}
                and all their associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteClient.isPending}
              >
                {deleteClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Step 1: Create Client ── */}
        <Dialog open={step === "create-client"} onOpenChange={(open) => !open && closeAll()}>
          <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleClientSubmit} noValidate className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client Information</p>
                <div className="space-y-1">
                  <Label>Client Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Acme Plumbers"
                    value={formData.name}
                    onChange={(e) => { setFormData((p) => ({ ...p, name: e.target.value })); if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined })); }}
                    className={formErrors.name ? "border-destructive" : ""}
                  />
                  <FieldError msg={formErrors.name} />
                </div>
                <div className="space-y-1">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={(e) => { setFormData((p) => ({ ...p, email: e.target.value })); if (formErrors.email) setFormErrors((p) => ({ ...p, email: undefined })); }}
                    className={formErrors.email ? "border-destructive" : ""}
                  />
                  <FieldError msg={formErrors.email} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Company</Label>
                    <Input value={formData.company} onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))} placeholder="Acme Inc." />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Website URL</Label>
                  <Input type="url" value={formData.websiteUrl} onChange={(e) => setFormData((p) => ({ ...p, websiteUrl: e.target.value }))} placeholder="https://example.com" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account Information</p>
                <div className="space-y-1">
                  <Label>Account Type</Label>
                  <Select value={formData.accountType} onValueChange={(v) => setFormData((p) => ({ ...p, accountType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account type..." /></SelectTrigger>
                    <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Account User Name</Label>
                  <Input value={formData.accountUserName} onChange={(e) => setFormData((p) => ({ ...p, accountUserName: e.target.value }))} placeholder="John Doe" />
                </div>
                <div className="space-y-1">
                  <Label>Account Email</Label>
                  <Input type="email" value={formData.accountUser} onChange={(e) => setFormData((p) => ({ ...p, accountUser: e.target.value }))} placeholder="john@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Contact / Billing Email</Label>
                  <Input type="email" value={formData.contactBillingEmail} onChange={(e) => setFormData((p) => ({ ...p, contactBillingEmail: e.target.value }))} placeholder="billing@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Plan</Label>
                  <Select value={formData.assignedPlanId} onValueChange={(v) => setFormData((p) => ({ ...p, assignedPlanId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>{plans?.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Created By <span className="text-destructive">*</span></Label>
                  <Select value={formData.createdBy} onValueChange={(v) => setFormData((p) => ({ ...p, createdBy: v }))}>
                    <SelectTrigger className={formErrors.createdBy ? "border-destructive" : ""}><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>{CREATED_BY_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <FieldError msg={formErrors.createdBy} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                {createClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Client
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Step 2: Prompt Business ── */}
        <Dialog open={step === "prompt-business"} onOpenChange={(open) => !open && closeAll()}>
          <DialogContent aria-describedby={undefined} className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Add Business Profile?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Would you like to add a Google Business (GMB) profile for{" "}
              <span className="font-semibold text-foreground">{newClientName}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <Button className="flex-1" onClick={() => { setBizForm(EMPTY_BIZ); setBizErrors({}); setStep("add-business"); }}>Yes, Add Business</Button>
              <Button variant="outline" className="flex-1" onClick={() => { toast({ title: `Client "${newClientName}" created` }); closeAll(); }}>No, Skip</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Step 3: Add Business Form ── */}
        <Dialog open={step === "add-business"} onOpenChange={(open) => !open && closeAll()}>
          <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Add Business</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBizSubmit} noValidate className="space-y-4">
              <div className="space-y-1">
                <Label>Business Name <span className="text-destructive">*</span></Label>
                <Input value={bizForm.businessName} onChange={(e) => { setBizForm((p) => ({ ...p, businessName: e.target.value })); if (bizErrors.businessName) setBizErrors((p) => ({ ...p, businessName: undefined })); }} placeholder="Joe's Plumbing" className={bizErrors.businessName ? "border-destructive" : ""} />
                <FieldError msg={bizErrors.businessName} />
              </div>
              <div className="space-y-1">
                <Label>Service Category</Label>
                <Select value={bizForm.category} onValueChange={(v) => setBizForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{SERVICE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>GMB URL</Label>
                <Input value={bizForm.gmbUrl} onChange={(e) => setBizForm((p) => ({ ...p, gmbUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/..." />
              </div>
              <div className="space-y-1">
                <Label>Website</Label>
                <Input value={bizForm.website} onChange={(e) => setBizForm((p) => ({ ...p, website: e.target.value }))} placeholder="https://example.com" />
              </div>
              <div className="space-y-1">
                <Label>Published (GMB) Address</Label>
                <Input value={bizForm.address} onChange={(e) => setBizForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Brooklyn, NY" />
              </div>
              <div className="space-y-1">
                <Label>Zip Code</Label>
                <Input value={bizForm.zipCode} onChange={(e) => setBizForm((p) => ({ ...p, zipCode: e.target.value }))} placeholder="10001" />
              </div>
              <div className="space-y-1">
                <Label>Created By <span className="text-destructive">*</span></Label>
                <Select value={bizForm.createdBy} onValueChange={(v) => { setBizForm((p) => ({ ...p, createdBy: v })); if (bizErrors.createdBy) setBizErrors((p) => ({ ...p, createdBy: undefined })); }}>
                  <SelectTrigger className={bizErrors.createdBy ? "border-destructive" : ""}><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>{CREATED_BY_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError msg={bizErrors.createdBy} />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" className="flex-1" disabled={createBusiness.isPending}>
                  {createBusiness.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Business
                </Button>
                <Button type="button" variant="outline" onClick={() => setStep("prompt-business")}>Back</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Step 4: Prompt Campaign ── */}
        <Dialog open={step === "prompt-campaign"} onOpenChange={(open) => !open && closeAll()}>
          <DialogContent aria-describedby={undefined} className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" /> Add Campaign?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Business profile saved! Would you like to create a campaign for{" "}
              <span className="font-semibold text-foreground">{bizForm.businessName}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <Button className="flex-1" onClick={() => { setCampErrors({}); setStep("add-campaign"); }}>Yes, Add Campaign</Button>
              <Button variant="outline" className="flex-1" onClick={() => { toast({ title: "Business profile added successfully" }); closeAll(); }}>No, Skip</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Step 5: Add Campaign Form ── */}
        <Dialog open={step === "add-campaign"} onOpenChange={(open) => !open && closeAll()}>
          <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Add Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCampSubmit} noValidate className="space-y-4">
              <div className="space-y-1">
                <Label>Campaign Name <span className="text-destructive">*</span></Label>
                <Input value={campForm.name} onChange={(e) => { setCampForm((p) => ({ ...p, name: e.target.value })); if (campErrors.name) setCampErrors((p) => ({ ...p, name: undefined })); }} placeholder="Business Name, City" className={campErrors.name ? "border-destructive" : ""} />
                <FieldError msg={campErrors.name} />
              </div>
              <div className="space-y-1">
                <Label>Search Address</Label>
                <Input value={campForm.searchAddress} onChange={(e) => setCampForm((p) => ({ ...p, searchAddress: e.target.value }))} placeholder="123 Main St, Brooklyn, NY" />
              </div>
              <div className="space-y-1">
                <Label>Plan Type <span className="text-destructive">*</span></Label>
                <Select value={campForm.planType} onValueChange={(v) => { setCampForm((p) => ({ ...p, planType: v })); if (campErrors.planType) setCampErrors((p) => ({ ...p, planType: undefined })); }}>
                  <SelectTrigger className={campErrors.planType ? "border-destructive" : ""}><SelectValue placeholder="Select plan type" /></SelectTrigger>
                  <SelectContent>{PLAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError msg={campErrors.planType} />
              </div>
              <div className="space-y-1">
                <Label>Created By <span className="text-destructive">*</span></Label>
                <Select value={campForm.createdBy} onValueChange={(v) => { setCampForm((p) => ({ ...p, createdBy: v })); if (campErrors.createdBy) setCampErrors((p) => ({ ...p, createdBy: undefined })); }}>
                  <SelectTrigger className={campErrors.createdBy ? "border-destructive" : ""}><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>{CREATED_BY_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError msg={campErrors.createdBy} />
              </div>
              <Separator />
              <p className="text-sm font-medium text-muted-foreground">
                Subscription <span className="font-normal text-xs">(Manual entry — fill in if you have it)</span>
              </p>
              <div className="space-y-1">
                <Label>Subscription ID</Label>
                <Input value={campForm.subscriptionId} onChange={(e) => setCampForm((p) => ({ ...p, subscriptionId: e.target.value }))} placeholder="sub_xxxxxxxxxxxx" />
              </div>
              <div className="space-y-1">
                <Label>Card (last 4)</Label>
                <Input value={campForm.cardLast4} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 4); setCampForm((p) => ({ ...p, cardLast4: val })); if (campErrors.cardLast4) setCampErrors((p) => ({ ...p, cardLast4: undefined })); }} placeholder="4242" maxLength={4} className={campErrors.cardLast4 ? "border-destructive" : ""} />
                <FieldError msg={campErrors.cardLast4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={campForm.startDate} onChange={(e) => setCampForm((p) => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Next Billing Date</Label>
                  <Input type="date" value={campForm.nextBillingDate} onChange={(e) => setCampForm((p) => ({ ...p, nextBillingDate: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" className="flex-1" disabled={createCampaign.isPending}>
                  {createCampaign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
                </Button>
                <Button type="button" variant="outline" onClick={closeAll}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
