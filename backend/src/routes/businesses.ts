import { Router } from "express";
import type { IRouter } from "express";
import { db, businessesTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  const r = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(r as string, 10);
}

function formatBusiness(b: typeof businessesTable.$inferSelect) {
  return {
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

router.get("/businesses", requireAuth, async (req, res): Promise<void> => {
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
  let query = db.select().from(businessesTable).$dynamic();
  if (clientId) query = query.where(eq(businessesTable.clientId, clientId));
  const businesses = await query.orderBy(businessesTable.businessName);
  res.json(businesses.map(formatBusiness));
});

router.post("/businesses", requireAuth, async (req, res): Promise<void> => {
  const { clientId, businessName, address, phone, website, category, hours, gmbUrl, zipCode, isSab, serviceArea, createdBy } = req.body;
  if (!clientId || !businessName) {
    res.status(400).json({ error: "clientId and businessName are required" });
    return;
  }
  const [business] = await db.insert(businessesTable).values({
    clientId: parseInt(clientId),
    businessName,
    address: address || null,
    phone: phone || null,
    website: website || null,
    category: category || null,
    hours: hours || null,
    gmbUrl: gmbUrl || null,
    zipCode: zipCode || null,
    isSab: isSab === true || isSab === "true",
    serviceArea: serviceArea || null,
    createdBy: createdBy || null,
  }).returning();
  res.status(201).json(formatBusiness(business));
});

router.get("/businesses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, id));
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }
  res.json(formatBusiness(business));
});

router.patch("/businesses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { businessName, address, phone, website, category, hours, gmbUrl, zipCode, isSab, serviceArea, createdBy } = req.body;
  const updateData: Partial<typeof businessesTable.$inferInsert> = {};
  if (businessName !== undefined) updateData.businessName = businessName;
  if (address !== undefined) updateData.address = address;
  if (phone !== undefined) updateData.phone = phone;
  if (website !== undefined) updateData.website = website;
  if (category !== undefined) updateData.category = category;
  if (hours !== undefined) updateData.hours = hours;
  if (gmbUrl !== undefined) updateData.gmbUrl = gmbUrl;
  if (zipCode !== undefined) updateData.zipCode = zipCode;
  if (isSab !== undefined) updateData.isSab = isSab === true || isSab === "true";
  if (serviceArea !== undefined) updateData.serviceArea = serviceArea || null;
  if (createdBy !== undefined) updateData.createdBy = createdBy;
  const [business] = await db.update(businessesTable).set(updateData).where(eq(businessesTable.id, id)).returning();
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }
  res.json(formatBusiness(business));
});

router.delete("/businesses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [business] = await db.delete(businessesTable).where(eq(businessesTable.id, id)).returning();
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }
  res.sendStatus(204);
});

router.get("/clients/:id/businesses", requireAuth, async (req, res): Promise<void> => {
  const clientId = parseId(req.params.id);
  const businesses = await db.select().from(businessesTable).where(eq(businessesTable.clientId, clientId)).orderBy(businessesTable.createdAt);
  res.json(businesses.map(formatBusiness));
});

export default router;
