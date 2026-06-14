import { pgTable, text, serial, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { campaignsTable } from "./campaigns";
import { businessesTable } from "./businesses";

export const geoGridConfigsTable = pgTable("geo_grid_configs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  businessId: integer("business_id").references(() => businessesTable.id, { onDelete: "set null" }),
  keyword: text("keyword").notNull(),
  centerAddress: text("center_address"),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  radiusMiles: integer("radius_miles").notNull().default(5),
  gridSize: integer("grid_size").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
});

export const geoGridResultsTable = pgTable("geo_grid_results", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").notNull().references(() => geoGridConfigsTable.id, { onDelete: "cascade" }),
  gridRow: integer("grid_row").notNull(),
  gridCol: integer("grid_col").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  rank: integer("rank"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
