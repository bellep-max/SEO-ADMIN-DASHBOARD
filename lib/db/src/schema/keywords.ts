import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const keywordsTable = pgTable("keywords", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id),
  keywordText: text("keyword_text").notNull(),
  keywordType: text("keyword_type").notNull().default("keywords"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  currentRank: integer("current_rank"),
  previousRank: integer("previous_rank"),
  searchVolume: integer("search_volume"),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
});

export const keywordRankHistoryTable = pgTable("keyword_rank_history", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywordsTable.id),
  rank: integer("rank"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKeywordSchema = createInsertSchema(keywordsTable).omit({ id: true, lastUpdated: true });
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywordsTable.$inferSelect;
export type KeywordRankHistory = typeof keywordRankHistoryTable.$inferSelect;
