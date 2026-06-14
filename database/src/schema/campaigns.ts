import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { plansTable } from "./plans";
import { businessesTable } from "./businesses";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  name: text("name").notNull(),
  targetDomain: text("target_domain"),
  targetLocation: text("target_location"),
  targetLanguage: text("target_language"),
  status: text("status").notNull().default("active"),
  searchAddress: text("search_address"),
  planId: integer("plan_id").references(() => plansTable.id),
  businessId: integer("business_id").references(() => businessesTable.id),
  createdBy: text("created_by"),
  subscriptionId: text("subscription_id"),
  cardLast4: text("card_last4"),
  startDate: text("start_date"),
  nextBillingDate: text("next_billing_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
