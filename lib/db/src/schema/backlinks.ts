import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const backlinksTable = pgTable("backlinks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  sourceUrl: text("source_url").notNull(),
  targetUrl: text("target_url").notNull(),
  anchorText: text("anchor_text"),
  authorityScore: integer("authority_score"),
  isToxic: boolean("is_toxic").notNull().default(false),
  status: text("status").notNull().default("new"),
  firstDetected: timestamp("first_detected", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
});

export const insertBacklinkSchema = createInsertSchema(backlinksTable).omit({ id: true, firstDetected: true });
export type InsertBacklink = z.infer<typeof insertBacklinkSchema>;
export type Backlink = typeof backlinksTable.$inferSelect;
