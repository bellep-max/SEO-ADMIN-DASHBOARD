import { useState } from "react";
import { Link } from "wouter";
import {
  useListBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
  useDeleteBusiness,
  useListClients,
  getListBusinessesQueryKey,
  Business,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Building2, MapPin, Phone, Globe, ExternalLink, Pencil, Trash2, Clock } from "lucide-react";

const CATEGORIES = ["Plumber", "Electrician", "Café", "Restaurant", "Dentist", "Lawyer", "HVAC", "Landscaping", "Cleaning", "Auto Repair", "Gym", "Salon", "Flooring", "Roofing", "Other"];

type BusinessFormState = {
  clientId: string;
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

const emptyForm: BusinessFormState = {
  clientId: "",
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

export default function Businesses() {
  const { data: businesses, isLoading } = useListBusinesses();
  const { data: clients } = useListClients();
  const createBusiness = useCreateBusiness();
  const updateBusiness = useUpdateBusiness();
  const deleteBusiness = useDeleteBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBusiness, setEditBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState<BusinessFormState>(emptyForm);

  const filtered = (businesses || []).filter(b =>
    b.businessName.toLowerCase().includes(search.toLowerCase()) ||
    (b.category || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.address || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setForm(emptyForm);
    setIsCreateOpen(true);
  }

  function openEdit(b: Business) {
    setEditBusiness(b);
    setForm({
      clientId: String(b.clientId),
      businessName: b.businessName,
      address: b.address || "",
      phone: b.phone || "",
      website: b.website || "",
      category: b.category || "",
      hours: b.hours || "",
      gmbUrl: b.gmbUrl || "",
      isSab: b.isSab ?? false,
      serviceArea: b.serviceArea || "",
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.businessName) return;
    createBusiness.mutate({
      data: {
        clientId: parseInt(form.clientId),
        businessName: form.businessName,
        address: form.isSab ? undefined : (form.address || undefined),
        phone: form.phone || undefined,
        website: form.website || undefined,
        category: form.category || undefined,
        hours: form.hours || undefined,
        gmbUrl: form.gmbUrl || undefined,
        isSab: form.isSab,
        serviceArea: form.isSab ? (form.serviceArea || undefined) : undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
        setIsCreateOpen(false);
        setForm(emptyForm);
        toast({ title: "Business profile created" });
      },
      onError: (err: any) => {
        toast({ title: err?.message || "Failed to create business", variant: "destructive" });
      }
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editBusiness) return;
    updateBusiness.mutate({
      id: editBusiness.id,
      data: {
        businessName: form.businessName,
        address: form.isSab ? null : (form.address || null),
        phone: form.phone || null,
        website: form.website || null,
        category: form.category || null,
        hours: form.hours || null,
        gmbUrl: form.gmbUrl || null,
        isSab: form.isSab,
        serviceArea: form.isSab ? (form.serviceArea || null) : null,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
        setEditBusiness(null);
        toast({ title: "Business profile updated" });
      },
      onError: () => {
        toast({ title: "Failed to update business", variant: "destructive" });
      }
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteBusiness.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
        toast({ title: "Business profile deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete business", variant: "destructive" });
      }
    });
  }

  const clientsWithoutBusiness = (clients?.clients || []).filter(
    c => !(businesses || []).some(b => b.clientId === c.id)
  );

  const BusinessForm = ({ onSubmit, isPending, showClientSelect }: { onSubmit: (e: React.FormEvent) => void; isPending: boolean; showClientSelect: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {showClientSelect && (
        <div className="space-y-2">
          <Label>Client <span className="text-destructive">*</span></Label>
          <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clientsWithoutBusiness.length === 0
                ? <SelectItem value="none" disabled>All clients have a business profile</SelectItem>
                : clientsWithoutBusiness.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>)
              }
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Business Name <span className="text-destructive">*</span></Label>
        <Input required value={form.businessName} onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))} placeholder="Joe's Plumbing" />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 py-1">
        <Checkbox
          id="isSab"
          checked={form.isSab}
          onCheckedChange={v => setForm(p => ({ ...p, isSab: !!v }))}
        />
        <div>
          <Label htmlFor="isSab" className="cursor-pointer font-medium">Service Area Business (SAB)</Label>
          <p className="text-xs text-muted-foreground">Business serves customers at their location — physical address is hidden on Google</p>
        </div>
      </div>

      {form.isSab ? (
        <div className="space-y-2">
          <Label>Service Area</Label>
          <Input value={form.serviceArea} onChange={e => setForm(p => ({ ...p, serviceArea: e.target.value }))} placeholder="e.g. New York City and surrounding 30 miles" />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, New York, NY 10001" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555-000-0000" />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://example.com" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Business Hours</Label>
        <Input value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} placeholder="Mon-Fri 9am-5pm, Sat 10am-3pm" />
      </div>
      <div className="space-y-2">
        <Label>Google Maps URL</Label>
        <Input value={form.gmbUrl} onChange={e => setForm(p => ({ ...p, gmbUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/..." />
      </div>
      <Button type="submit" className="w-full" disabled={isPending || (showClientSelect && !form.clientId)}>
        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {showClientSelect ? "Create Business Profile" : "Save Changes"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Businesses</h1>
          <p className="text-muted-foreground mt-1">GMB / Google Business profiles for your clients</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Business</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Business Profile</DialogTitle></DialogHeader>
            <BusinessForm onSubmit={handleCreate} isPending={createBusiness.isPending} showClientSelect={true} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search businesses..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} business{filtered.length !== 1 ? "es" : ""}</span>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Building2 className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {search ? "No businesses match your search." : "No business profiles yet. Add one to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(b => {
            const client = (clients?.clients || []).find(c => c.id === b.clientId);
            return (
              <Card key={b.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{b.businessName}</h3>
                        {b.category && <Badge variant="secondary" className="text-xs shrink-0">{b.category}</Badge>}
                        {b.isSab && <Badge variant="outline" className="text-xs shrink-0 border-blue-500/30 text-blue-600 bg-blue-500/10">SAB</Badge>}
                      </div>
                      {client && (
                        <Link href={`/clients/${b.clientId}`} className="text-xs text-primary hover:underline mt-0.5 block">
                          {client.name} {client.company ? `· ${client.company}` : ""}
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(b.id, b.businessName)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {b.isSab && b.serviceArea && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500/70" />
                        <span className="text-blue-600/80">{b.serviceArea}</span>
                      </div>
                    )}
                    {!b.isSab && b.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                        <span>{b.address}</span>
                      </div>
                    )}
                    {b.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <a href={`tel:${b.phone}`} className="hover:text-foreground">{b.phone}</a>
                      </div>
                    )}
                    {b.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <a href={b.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                          {b.website.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {b.hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <span>{b.hours}</span>
                      </div>
                    )}
                    {b.gmbUrl && (
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <a href={b.gmbUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">
                          View on Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editBusiness} onOpenChange={v => { if (!v) setEditBusiness(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Business Profile</DialogTitle></DialogHeader>
          <BusinessForm onSubmit={handleUpdate} isPending={updateBusiness.isPending} showClientSelect={false} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
