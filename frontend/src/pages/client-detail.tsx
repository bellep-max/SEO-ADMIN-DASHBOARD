import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetClient,
  useUpdateClient,
  useGetClientCampaigns,
  useGetClientKeywords,
  useGetClientBacklinks,
  useListPlans,
  useCreateCampaign,
  useDeleteKeyword,
  useRefreshKeywordRank,
  getGetClientQueryKey,
  getGetClientCampaignsQueryKey,
  getGetClientKeywordsQueryKey,
  getGetClientBacklinksQueryKey,
  getListPlansQueryKey,
} from "@workspace/api-client-react";
import type { Client, Campaign, Keyword, Backlink, Plan } from "@workspace/api-client-react";
import { AddKeywordDialog } from "@/components/add-keyword-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Building2,
  MapPin,
  Phone,
  Globe,
  Clock,
  Trash2,
  RefreshCw,
  Link2,
  Pencil,
} from "lucide-react";

const ACCOUNT_TYPES = ["Agency", "Retail", "Personal Business Account"];
const CREATED_BY_ROLES = ["Admin", "Manager", "Sales Rep", "Agent", "Client"];

const GMB_CATEGORIES = [
  "Plumber", "Electrician", "Café", "Restaurant", "Dentist",
  "Lawyer", "HVAC", "Landscaping", "Cleaning", "Auto Repair",
  "Gym", "Salon", "Flooring", "Roofing", "Other",
];

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
    if (res.status === 404) throw Object.assign(new Error("not_found"), { status: 404 });
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    if (res.status === 204) return null;
    return res.json();
  });
}

type BusinessProfile = {
  id: number;
  clientId: number;
  businessName: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  hours: string | null;
  gmbUrl: string | null;
  isSab: boolean | null;
  serviceArea: string | null;
};

type BusinessForm = {
  businessName: string;
  address: string;
  phone: string;
  website: string;
  category: string;
  hours: string;
  gmbUrl: string;
  isSab: boolean;
  serviceArea: string;
};

const EMPTY_BIZ_FORM: BusinessForm = {
  businessName: "",
  address: "",
  phone: "",
  website: "",
  category: "",
  hours: "",
  gmbUrl: "",
  isSab: false,
  serviceArea: "",
};

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const { id } = params;
  const clientId = id ? parseInt(id, 10) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: client, isLoading } = useGetClient<Client>(clientId, {
    query: { enabled: clientId > 0, queryKey: getGetClientQueryKey(clientId) },
  });

  const { data: campaigns } = useGetClientCampaigns<Campaign[]>(clientId, {
    query: { enabled: clientId > 0, queryKey: getGetClientCampaignsQueryKey(clientId) },
  });

  const { data: keywords } = useGetClientKeywords<Keyword[]>(clientId, {
    query: { enabled: clientId > 0, queryKey: getGetClientKeywordsQueryKey(clientId) },
  });

  const { data: backlinks } = useGetClientBacklinks<Backlink[]>(clientId, {
    query: { enabled: clientId > 0, queryKey: getGetClientBacklinksQueryKey(clientId) },
  });

  const { data: plans } = useListPlans<Plan[]>({ query: { queryKey: getListPlansQueryKey() } });

  const bizKey = [`/api/clients/${clientId}/businesses`];
  const { data: businesses = [] } = useQuery<BusinessProfile[]>({
    queryKey: bizKey,
    queryFn: () =>
      authFetch(`/api/clients/${clientId}/businesses`).catch((e) => {
        if (e?.status === 404) return [];
        throw e;
      }),
    enabled: clientId > 0,
    retry: false,
  });

  const updateClient = useUpdateClient();
  const createCampaign = useCreateCampaign();

  const createBusiness = useMutation<BusinessProfile, Error, BusinessForm>({
    mutationFn: (form) =>
      authFetch("/api/businesses", {
        method: "POST",
        body: JSON.stringify({ clientId, ...form }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bizKey });
      setBizDialog(null);
      toast({ title: "Business profile created" });
    },
    onError: () => toast({ title: "Failed to create business", variant: "destructive" }),
  });

  const updateBusiness = useMutation<BusinessProfile, Error, { id: number; form: BusinessForm }>({
    mutationFn: ({ id: bizId, form }) =>
      authFetch(`/api/businesses/${bizId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bizKey });
      setBizDialog(null);
      toast({ title: "Business profile updated" });
    },
    onError: () => toast({ title: "Failed to update business", variant: "destructive" }),
  });

  const deleteBusiness = useMutation<null, Error, number>({
    mutationFn: (bizId) =>
      authFetch(`/api/businesses/${bizId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bizKey });
      toast({ title: "Business profile deleted" });
    },
    onError: () => toast({ title: "Failed to delete business", variant: "destructive" }),
  });

  const deleteKeyword = useDeleteKeyword();
  const refreshRank = useRefreshKeywordRank();

  const [bizDialog, setBizDialog] = useState<{ mode: "add" | "edit"; biz?: BusinessProfile } | null>(null);
  const [bizForm, setBizForm] = useState<BusinessForm>(EMPTY_BIZ_FORM);

  function openAddBiz() {
    setBizForm(EMPTY_BIZ_FORM);
    setBizDialog({ mode: "add" });
  }

  function openEditBiz(biz: BusinessProfile) {
    setBizForm({
      businessName: biz.businessName,
      address: biz.address ?? "",
      phone: biz.phone ?? "",
      website: biz.website ?? "",
      category: biz.category ?? "",
      hours: biz.hours ?? "",
      gmbUrl: biz.gmbUrl ?? "",
      isSab: biz.isSab ?? false,
      serviceArea: biz.serviceArea ?? "",
    });
    setBizDialog({ mode: "edit", biz });
  }

  function handleBizSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (bizDialog?.mode === "edit" && bizDialog.biz) {
      updateBusiness.mutate({ id: bizDialog.biz.id, form: bizForm });
    } else {
      createBusiness.mutate(bizForm);
    }
  }

  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isAddKeywordOpen, setIsAddKeywordOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<{
    name: string;
    targetDomain: string;
    targetLocation: string;
    targetLanguage: string;
    status: "active" | "paused" | "completed";
  }>({
    name: "",
    targetDomain: "",
    targetLocation: "US",
    targetLanguage: "en",
    status: "active",
  });

  const handleStatusToggle = () => {
    if (!client) return;
    const newStatus = client.status === "active" ? "inactive" : "active";
    updateClient.mutate(
      { id: clientId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          toast({ title: `Client marked as ${newStatus}` });
        },
      }
    );
  };

  const handlePlanChange = (planId: string) => {
    if (!client) return;
    updateClient.mutate(
      { id: clientId, data: { assignedPlanId: planId === "none" ? null : parseInt(planId, 10) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          toast({ title: "Plan updated" });
        },
      }
    );
  };

  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClientForm, setEditClientForm] = useState({
    name: "", email: "", company: "", phone: "", websiteUrl: "",
    accountType: "", accountUserName: "", accountUser: "",
    contactBillingEmail: "", assignedPlanId: "", createdBy: "",
  });

  function openEditClient() {
    setEditClientForm({
      name: client?.name ?? "",
      email: client?.email ?? "",
      company: client?.company ?? "",
      phone: client?.phone ?? "",
      websiteUrl: client?.websiteUrl ?? "",
      accountType: (client as any)?.accountType ?? "",
      accountUserName: (client as any)?.accountUserName ?? "",
      accountUser: (client as any)?.accountUser ?? "",
      contactBillingEmail: (client as any)?.contactBillingEmail ?? "",
      assignedPlanId: client?.assignedPlanId?.toString() ?? "",
      createdBy: (client as any)?.createdBy ?? "",
    });
    setEditClientOpen(true);
  }

  function handleEditClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateClient.mutate(
      {
        id: clientId,
        data: {
          name: editClientForm.name || undefined,
          email: editClientForm.email || undefined,
          company: editClientForm.company || null,
          phone: editClientForm.phone || null,
          websiteUrl: editClientForm.websiteUrl || null,
          accountType: editClientForm.accountType || null,
          accountUserName: editClientForm.accountUserName || null,
          accountUser: editClientForm.accountUser || null,
          contactBillingEmail: editClientForm.contactBillingEmail || null,
          assignedPlanId: editClientForm.assignedPlanId ? parseInt(editClientForm.assignedPlanId) : null,
          createdBy: editClientForm.createdBy || null,
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          setEditClientOpen(false);
          toast({ title: "Client updated" });
        },
        onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
      }
    );
  }

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaign.mutate(
      { data: { ...campaignForm, clientId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientCampaignsQueryKey(clientId) });
          setIsCampaignDialogOpen(false);
          setCampaignForm({ name: "", targetDomain: "", targetLocation: "US", targetLanguage: "en", status: "active" });
          toast({ title: "Campaign created", description: `"${campaignForm.name}" is now active.` });
        },
        onError: () => toast({ title: "Failed to create campaign", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return <div className="p-8 text-muted-foreground">Client not found.</div>;
  }

  const bizPending = createBusiness.isPending || updateBusiness.isPending;
  const isEditMode = bizDialog?.mode === "edit";

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
            {client.company || "No company"} &bull; {client.email}
            {client.websiteUrl && (
              <a
                href={client.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center text-primary hover:underline ml-2"
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Visit Site
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={client.assignedPlanId?.toString() ?? "none"}
            onValueChange={handlePlanChange}
            disabled={updateClient.isPending}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Assign plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Plan</SelectItem>
              {plans?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleStatusToggle}
            disabled={updateClient.isPending}
          >
            {updateClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {client.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="business">
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Business ({businesses.length})
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            Campaigns ({campaigns?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="keywords">
            Keywords ({keywords?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="backlinks">
            Backlinks ({backlinks?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaigns?.length ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tracked Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keywords?.length ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Backlinks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{backlinks?.length ?? 0}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Client Details</CardTitle>
              <Button variant="outline" size="sm" onClick={openEditClient} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="grid grid-cols-2 gap-y-2.5">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{client.name}</span>
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{client.email}</span>
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium">{client.company || "—"}</span>
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{(client as any).phone || "—"}</span>
                <span className="text-muted-foreground">Website</span>
                <span className="font-medium">
                  {client.websiteUrl ? (
                    <a href={client.websiteUrl} target="_blank" rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 w-fit">
                      {client.websiteUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : "—"}
                </span>
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{client.planName || "No plan"}</span>
                <span className="text-muted-foreground">Account Type</span>
                <span className="font-medium">{(client as any).accountType || "—"}</span>
                <span className="text-muted-foreground">Account User</span>
                <span className="font-medium">{(client as any).accountUserName || "—"}</span>
                <span className="text-muted-foreground">Account Email</span>
                <span className="font-medium">{(client as any).accountUser || "—"}</span>
                <span className="text-muted-foreground">Billing Email</span>
                <span className="font-medium">{(client as any).contactBillingEmail || "—"}</span>
                <span className="text-muted-foreground">Created By</span>
                <span className="font-medium">{(client as any).createdBy || "—"}</span>
                <span className="text-muted-foreground">Status</span>
                <span>
                  <Badge variant={client.status === "active" ? "default" : "secondary"}>
                    {client.status}
                  </Badge>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Edit Client Dialog ── */}
          <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
            <DialogContent aria-describedby={undefined} className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditClientSubmit} className="space-y-5">

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client Information</p>
                  <div className="space-y-1">
                    <Label>Client Name <span className="text-destructive">*</span></Label>
                    <Input required value={editClientForm.name}
                      onChange={(e) => setEditClientForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Acme Plumbers" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input required type="email" value={editClientForm.email}
                      onChange={(e) => setEditClientForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="client@example.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Company</Label>
                      <Input value={editClientForm.company}
                        onChange={(e) => setEditClientForm((p) => ({ ...p, company: e.target.value }))}
                        placeholder="Acme Inc." />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={editClientForm.phone}
                        onChange={(e) => setEditClientForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+1 555-000-0000" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Website URL</Label>
                    <Input type="url" value={editClientForm.websiteUrl}
                      onChange={(e) => setEditClientForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                      placeholder="https://example.com" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account Information</p>
                  <div className="space-y-1">
                    <Label>Account Type</Label>
                    <Select value={editClientForm.accountType}
                      onValueChange={(v) => setEditClientForm((p) => ({ ...p, accountType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select account type..." /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Account User Name</Label>
                    <Input value={editClientForm.accountUserName}
                      onChange={(e) => setEditClientForm((p) => ({ ...p, accountUserName: e.target.value }))}
                      placeholder="John Doe" />
                  </div>
                  <div className="space-y-1">
                    <Label>Account Email</Label>
                    <Input type="email" value={editClientForm.accountUser}
                      onChange={(e) => setEditClientForm((p) => ({ ...p, accountUser: e.target.value }))}
                      placeholder="john@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Contact / Billing Email</Label>
                    <Input type="email" value={editClientForm.contactBillingEmail}
                      onChange={(e) => setEditClientForm((p) => ({ ...p, contactBillingEmail: e.target.value }))}
                      placeholder="billing@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Plan</Label>
                    <Select value={editClientForm.assignedPlanId}
                      onValueChange={(v) => setEditClientForm((p) => ({ ...p, assignedPlanId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Plan</SelectItem>
                        {plans?.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Created By</Label>
                    <Select value={editClientForm.createdBy}
                      onValueChange={(v) => setEditClientForm((p) => ({ ...p, createdBy: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {CREATED_BY_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={updateClient.isPending}>
                    {updateClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditClientOpen(false)}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Business ── */}
        <TabsContent value="business" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openAddBiz}>
              <Plus className="w-4 h-4 mr-2" /> Add Business
            </Button>
          </div>

          {businesses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <Building2 className="w-10 h-10 text-muted-foreground/40" />
                <div>
                  <p className="font-medium">No Business Profiles Yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a GMB / Google Business profile for {client.name}
                  </p>
                </div>
                <Button onClick={openAddBiz}>
                  <Plus className="w-4 h-4 mr-2" /> Add Business Profile
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {businesses.map((biz) => (
                <Card key={biz.id}>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <CardTitle className="text-base">{biz.businessName}</CardTitle>
                      {biz.category && <Badge variant="secondary">{biz.category}</Badge>}
                      {biz.isSab && (
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600 bg-blue-500/10">SAB</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBiz(biz)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${biz.businessName}"? This cannot be undone.`)) {
                            deleteBusiness.mutate(biz.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    {biz.isSab && biz.serviceArea && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500/70" />
                        <span className="text-blue-600/80">{biz.serviceArea}</span>
                      </div>
                    )}
                    {biz.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                        <span>{biz.address}</span>
                      </div>
                    )}
                    {biz.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <a href={`tel:${biz.phone}`} className="hover:text-foreground">{biz.phone}</a>
                      </div>
                    )}
                    {biz.website && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <a href={biz.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 truncate">
                          {biz.website.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {biz.hours && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <span>{biz.hours}</span>
                      </div>
                    )}
                    {biz.gmbUrl && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <a href={biz.gmbUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">
                          View on Google Maps
                        </a>
                      </div>
                    )}
                    {!biz.serviceArea && !biz.address && !biz.phone && !biz.website && !biz.hours && !biz.gmbUrl && (
                      <p className="text-muted-foreground italic text-xs">No additional details.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add / Edit dialog */}
          <Dialog open={bizDialog !== null} onOpenChange={(open) => { if (!open) setBizDialog(null); }}>
            <DialogContent aria-describedby={undefined} className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Edit Business Profile" : "Add Business Profile"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBizSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Business Name <span className="text-destructive">*</span></Label>
                  <Input
                    required
                    value={bizForm.businessName}
                    onChange={(e) => setBizForm((p) => ({ ...p, businessName: e.target.value }))}
                    placeholder="Joe's Plumbing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={bizForm.category} onValueChange={(v) => setBizForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {GMB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-3 py-1">
                  <Checkbox
                    id="bizDialogIsSab"
                    checked={bizForm.isSab}
                    onCheckedChange={(v) => setBizForm((p) => ({ ...p, isSab: !!v }))}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="bizDialogIsSab" className="cursor-pointer font-medium">Service Area Business (SAB)</Label>
                    <p className="text-xs text-muted-foreground">Serves customers at their location — Google hides the address publicly</p>
                  </div>
                </div>
                {bizForm.isSab && (
                  <div className="space-y-2">
                    <Label>Service Area</Label>
                    <Input
                      value={bizForm.serviceArea}
                      onChange={(e) => setBizForm((p) => ({ ...p, serviceArea: e.target.value }))}
                      placeholder="e.g. New York City and surrounding 30 miles"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Address {bizForm.isSab && <span className="text-xs text-muted-foreground font-normal">(internal reference)</span>}</Label>
                  <Input
                    value={bizForm.address}
                    onChange={(e) => setBizForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="123 Main St, New York, NY 10001"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={bizForm.phone} onChange={(e) => setBizForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={bizForm.website} onChange={(e) => setBizForm((p) => ({ ...p, website: e.target.value }))} placeholder="https://example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Business Hours</Label>
                  <Input value={bizForm.hours} onChange={(e) => setBizForm((p) => ({ ...p, hours: e.target.value }))} placeholder="Mon-Fri 9am-5pm, Sat 10am-3pm" />
                </div>
                <div className="space-y-2">
                  <Label>Google Maps URL</Label>
                  <Input value={bizForm.gmbUrl} onChange={(e) => setBizForm((p) => ({ ...p, gmbUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/..." />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={bizPending}>
                    {bizPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditMode ? "Save Changes" : "Create Profile"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setBizDialog(null)}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Campaigns ── */}
        <TabsContent value="campaigns" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Campaign
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>New Campaign for {client.name}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCampaign} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      required
                      value={campaignForm.name}
                      onChange={(e) =>
                        setCampaignForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="Q3 Growth Campaign"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Domain</Label>
                    <Input
                      required
                      value={campaignForm.targetDomain}
                      onChange={(e) =>
                        setCampaignForm((p) => ({
                          ...p,
                          targetDomain: e.target.value,
                        }))
                      }
                      placeholder="example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={campaignForm.targetLocation}
                        onChange={(e) =>
                          setCampaignForm((p) => ({
                            ...p,
                            targetLocation: e.target.value,
                          }))
                        }
                        placeholder="US"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Input
                        value={campaignForm.targetLanguage}
                        onChange={(e) =>
                          setCampaignForm((p) => ({
                            ...p,
                            targetLanguage: e.target.value,
                          }))
                        }
                        placeholder="en"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={campaignForm.status}
                      onValueChange={(v) =>
                        setCampaignForm((p) => ({
                          ...p,
                          status: v as "active" | "paused" | "completed",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createCampaign.isPending}
                  >
                    {createCampaign.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Create Campaign
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
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
                {!campaigns?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No campaigns yet. Add one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.targetDomain}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.keywordCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Keywords ── */}
        <TabsContent value="keywords" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsAddKeywordOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Keyword
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!keywords?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No keywords yet. Click Add Keyword to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  keywords.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {k.keywordText}
                          {k.isPrimary && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">1st</Badge>
                          )}
                          {!k.isActive && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">inactive</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {k.campaignName}
                      </TableCell>
                      <TableCell>
                        {k.keywordType === "keywords_with_backlinks" ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <Link2 className="w-3 h-3" /> +Backlink
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Keyword</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {k.currentRank ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {k.rankChange != null ? (
                          k.rankChange > 0 ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              <ArrowUp className="w-3 h-3 mr-1" />{k.rankChange}
                            </Badge>
                          ) : k.rankChange < 0 ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                              <ArrowDown className="w-3 h-3 mr-1" />{Math.abs(k.rankChange)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground"><Minus className="w-3 h-3 inline" /></span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost" size="icon"
                          disabled={refreshRank.isPending}
                          onClick={() => refreshRank.mutate({ id: k.id }, {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getGetClientKeywordsQueryKey(clientId) });
                              toast({ title: "Rank refreshed" });
                            },
                          })}
                          title="Refresh rank"
                        >
                          <RefreshCw className={`w-4 h-4 text-muted-foreground hover:text-primary ${refreshRank.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this keyword?")) {
                              deleteKeyword.mutate({ id: k.id }, {
                                onSuccess: () => {
                                  queryClient.invalidateQueries({ queryKey: getGetClientKeywordsQueryKey(clientId) });
                                  toast({ title: "Keyword deleted" });
                                },
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <AddKeywordDialog
            open={isAddKeywordOpen}
            onClose={() => setIsAddKeywordOpen(false)}
            campaigns={campaigns ?? []}
            onCreated={() => queryClient.invalidateQueries({ queryKey: getGetClientKeywordsQueryKey(clientId) })}
          />
        </TabsContent>

        {/* ── Backlinks ── */}
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
                {!backlinks?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No backlinks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  backlinks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <a
                          href={b.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {b.sourceUrl}
                        </a>
                      </TableCell>
                      <TableCell className="text-right">
                        {b.authorityScore ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.status}</Badge>
                      </TableCell>
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
