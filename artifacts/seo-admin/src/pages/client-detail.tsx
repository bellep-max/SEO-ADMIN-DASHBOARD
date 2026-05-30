import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetClient,
  useUpdateClient,
  useGetClientCampaigns,
  useGetClientKeywords,
  useGetClientBacklinks,
  useGetClientBusiness,
  useCreateBusiness,
  useUpdateBusiness,
  useListPlans,
  useCreateCampaign,
  getGetClientQueryKey,
  getGetClientCampaignsQueryKey,
  getGetClientBusinessQueryKey,
  ClientStatus,
  CampaignStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, ArrowUp, ArrowDown, Minus, Plus, Building2, MapPin, Phone, Globe, Clock } from "lucide-react";

const GMB_CATEGORIES = ["Plumber", "Electrician", "Café", "Restaurant", "Dentist", "Lawyer", "HVAC", "Landscaping", "Cleaning", "Auto Repair", "Gym", "Salon", "Flooring", "Roofing", "Other"];

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = id ? parseInt(id) : 0;

  const { data: client, isLoading } = useGetClient(clientId, { query: { enabled: !!clientId } });
  const { data: campaigns } = useGetClientCampaigns(clientId, { query: { enabled: !!clientId } });
  const { data: keywords } = useGetClientKeywords(clientId, { query: { enabled: !!clientId } });
  const { data: backlinks } = useGetClientBacklinks(clientId, { query: { enabled: !!clientId } });
  const { data: plans } = useListPlans();
  const { data: business, isError: noBusinessYet } = useGetClientBusiness(clientId, {
    query: { enabled: !!clientId, retry: false }
  });

  const updateClient = useUpdateClient();
  const createCampaign = useCreateCampaign();
  const createBusiness = useCreateBusiness();
  const updateBusiness = useUpdateBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isBusinessEditing, setIsBusinessEditing] = useState(false);
  const [businessForm, setBusinessForm] = useState({
    businessName: "",
    address: "",
    phone: "",
    website: "",
    category: "",
    hours: "",
    gmbUrl: "",
  });

  function openBusinessForm() {
    setBusinessForm({
      businessName: business?.businessName || "",
      address: business?.address || "",
      phone: business?.phone || "",
      website: business?.website || "",
      category: business?.category || "",
      hours: business?.hours || "",
      gmbUrl: business?.gmbUrl || "",
    });
    setIsBusinessEditing(true);
  }

  function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (business) {
      updateBusiness.mutate({
        id: business.id,
        data: {
          businessName: businessForm.businessName,
          address: businessForm.address || null,
          phone: businessForm.phone || null,
          website: businessForm.website || null,
          category: businessForm.category || null,
          hours: businessForm.hours || null,
          gmbUrl: businessForm.gmbUrl || null,
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientBusinessQueryKey(clientId) });
          setIsBusinessEditing(false);
          toast({ title: "Business profile updated" });
        },
        onError: () => toast({ title: "Failed to update business", variant: "destructive" })
      });
    } else {
      createBusiness.mutate({
        data: {
          clientId,
          businessName: businessForm.businessName,
          address: businessForm.address || undefined,
          phone: businessForm.phone || undefined,
          website: businessForm.website || undefined,
          category: businessForm.category || undefined,
          hours: businessForm.hours || undefined,
          gmbUrl: businessForm.gmbUrl || undefined,
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientBusinessQueryKey(clientId) });
          setIsBusinessEditing(false);
          toast({ title: "Business profile created" });
        },
        onError: (err: any) => toast({ title: err?.message || "Failed to create business", variant: "destructive" })
      });
    }
  }

  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    targetDomain: "",
    targetLocation: "US",
    targetLanguage: "en",
    status: "active" as CampaignStatus,
  });

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

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaign.mutate({
      data: { ...campaignForm, clientId }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientCampaignsQueryKey(clientId) });
        setIsCampaignDialogOpen(false);
        setCampaignForm({ name: "", targetDomain: "", targetLocation: "US", targetLanguage: "en", status: "active" });
        toast({ title: "Campaign created", description: `"${campaignForm.name}" is now active.` });
      },
      onError: () => {
        toast({ title: "Failed to create campaign", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!client) return <div>Client not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge>
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
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign plan" /></SelectTrigger>
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
          <TabsTrigger value="business">
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Business {business ? "" : noBusinessYet ? "·" : ""}
          </TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns ({campaigns?.length || 0})</TabsTrigger>
          <TabsTrigger value="keywords">Keywords ({keywords?.length || 0})</TabsTrigger>
          <TabsTrigger value="backlinks">Backlinks ({backlinks?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Campaigns</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{campaigns?.length || 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tracked Keywords</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{keywords?.length || 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Backlinks</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{backlinks?.length || 0}</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Business Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">Company</span><span className="font-medium">{client.company || "—"}</span>
                <span className="text-muted-foreground">Email</span><span className="font-medium">{client.email}</span>
                <span className="text-muted-foreground">Website</span>
                <span className="font-medium">
                  {client.websiteUrl ? (
                    <a href={client.websiteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 w-fit">
                      {client.websiteUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : "—"}
                </span>
                <span className="text-muted-foreground">Plan</span><span className="font-medium">{client.planName || "No plan"}</span>
                <span className="text-muted-foreground">Status</span>
                <span><Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge></span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="mt-4">
          {isBusinessEditing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{business ? "Edit Business Profile" : "Add Business Profile"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBusinessSubmit} className="space-y-4 max-w-xl">
                  <div className="space-y-2">
                    <Label>Business Name <span className="text-destructive">*</span></Label>
                    <Input required value={businessForm.businessName} onChange={e => setBusinessForm(p => ({ ...p, businessName: e.target.value }))} placeholder="Joe's Plumbing" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={businessForm.category} onValueChange={v => setBusinessForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {GMB_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={businessForm.address} onChange={e => setBusinessForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, New York, NY 10001" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={businessForm.phone} onChange={e => setBusinessForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input value={businessForm.website} onChange={e => setBusinessForm(p => ({ ...p, website: e.target.value }))} placeholder="https://example.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Business Hours</Label>
                    <Input value={businessForm.hours} onChange={e => setBusinessForm(p => ({ ...p, hours: e.target.value }))} placeholder="Mon-Fri 9am-5pm, Sat 10am-3pm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Google Maps URL</Label>
                    <Input value={businessForm.gmbUrl} onChange={e => setBusinessForm(p => ({ ...p, gmbUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/..." />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createBusiness.isPending || updateBusiness.isPending}>
                      {(createBusiness.isPending || updateBusiness.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {business ? "Save Changes" : "Create Profile"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsBusinessEditing(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : business ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{business.businessName}</CardTitle>
                  {business.category && <Badge variant="secondary">{business.category}</Badge>}
                </div>
                <Button variant="outline" size="sm" onClick={openBusinessForm}>Edit</Button>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {business.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span>{business.address}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <a href={`tel:${business.phone}`} className="hover:text-foreground">{business.phone}</a>
                  </div>
                )}
                {business.website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <a href={business.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      {business.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {business.hours && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <span>{business.hours}</span>
                  </div>
                )}
                {business.gmbUrl && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <a href={business.gmbUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      View on Google Maps
                    </a>
                  </div>
                )}
                {!business.address && !business.phone && !business.website && !business.hours && !business.gmbUrl && (
                  <p className="text-muted-foreground italic">No additional details provided.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <Building2 className="w-10 h-10 text-muted-foreground/40" />
                <div>
                  <p className="font-medium">No Business Profile Yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add a GMB / Google Business profile for {client.name}</p>
                </div>
                <Button onClick={openBusinessForm}><Plus className="w-4 h-4 mr-2" /> Add Business Profile</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Campaign</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Campaign for {client.name}</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateCampaign} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input required value={campaignForm.name} onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))} placeholder="Q3 Growth Campaign" />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Domain</Label>
                    <Input required value={campaignForm.targetDomain} onChange={e => setCampaignForm(p => ({ ...p, targetDomain: e.target.value }))} placeholder="example.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input value={campaignForm.targetLocation} onChange={e => setCampaignForm(p => ({ ...p, targetLocation: e.target.value }))} placeholder="US" />
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Input value={campaignForm.targetLanguage} onChange={e => setCampaignForm(p => ({ ...p, targetLanguage: e.target.value }))} placeholder="en" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={campaignForm.status} onValueChange={v => setCampaignForm(p => ({ ...p, status: v as CampaignStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createCampaign.isPending}>
                    {createCampaign.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
                {campaigns?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No campaigns yet. Add one above.</TableCell></TableRow>
                ) : (
                  campaigns?.map(c => (
                    <TableRow key={c.id}>
                      <TableCell><Link href={`/campaigns/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></TableCell>
                      <TableCell className="text-muted-foreground">{c.targetDomain}</TableCell>
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
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No keywords yet.</TableCell></TableRow>
                ) : (
                  keywords?.map(k => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.keywordText}</TableCell>
                      <TableCell className="text-muted-foreground">{k.campaignName}</TableCell>
                      <TableCell className="text-right font-semibold">{k.currentRank || "—"}</TableCell>
                      <TableCell className="text-right">
                        {k.rankChange != null ? (
                          k.rankChange > 0 ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><ArrowUp className="w-3 h-3 mr-1" />{k.rankChange}</Badge>
                          ) : k.rankChange < 0 ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><ArrowDown className="w-3 h-3 mr-1" />{Math.abs(k.rankChange)}</Badge>
                          ) : <span className="text-muted-foreground"><Minus className="w-3 h-3 inline" /></span>
                        ) : <span className="text-muted-foreground">—</span>}
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
                      <TableCell><a href={b.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{b.sourceUrl}</a></TableCell>
                      <TableCell className="text-right">{b.authorityScore || "—"}</TableCell>
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
