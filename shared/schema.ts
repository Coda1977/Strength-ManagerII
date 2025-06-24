import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Onboarding and strengths data
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  topStrengths: jsonb("top_strengths").$type<string[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team members table
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    // Always use Node.js crypto for server-side UUID generation
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      // If crypto.randomUUID is not available, use crypto.randomBytes for secure generation
      try {
        const crypto = require('crypto');
        const bytes = crypto.randomBytes(16);
        // Format as UUID v4
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant bits
        const hex = bytes.toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      } catch (cryptoError) {
        // Absolute fallback - throw error rather than use weak generation
        throw new Error('Cryptographically secure UUID generation is not available. Cannot create team member ID.');
      }
    }
  }),
  managerId: varchar("manager_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      const crypto = require('crypto');
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }
  }),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  mode: text("mode", { enum: ["personal", "team"] }).notNull().default("personal"),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isArchived: boolean("is_archived").default(false),
  metadata: jsonb("metadata"),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      const crypto = require('crypto');
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }
  }),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: text("type", { enum: ["user", "ai"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

export const conversationBackups = pgTable("conversation_backups", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      const crypto = require('crypto');
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }
  }),
  userId: varchar("user_id").notNull(),
  backupData: jsonb("backup_data").notNull(),
  source: text("source", { enum: ["localStorage", "manual", "automatic"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  restoredAt: timestamp("restored_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserOnboardingSchema = createInsertSchema(users).pick({
  hasCompletedOnboarding: true,
  topStrengths: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).pick({
  managerId: true,
  name: true,
  strengths: true,
}).extend({
  // Ensure ID is optional since it will be generated securely
  id: z.string().uuid().optional(),
});

export const updateTeamMemberSchema = createInsertSchema(teamMembers).pick({
  name: true,
  strengths: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  title: true,
  mode: true,
  metadata: true,
});

export const updateConversationSchema = createInsertSchema(conversations).pick({
  title: true,
  mode: true,
  lastActivity: true,
  isArchived: true,
  metadata: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  content: true,
  type: true,
  metadata: true,
});

export const insertConversationBackupSchema = createInsertSchema(conversationBackups).pick({
  backupData: true,
  source: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserOnboarding = z.infer<typeof updateUserOnboardingSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type UpdateTeamMember = z.infer<typeof updateTeamMemberSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ConversationBackup = typeof conversationBackups.$inferSelect;
export type InsertConversationBackup = z.infer<typeof insertConversationBackupSchema>;
