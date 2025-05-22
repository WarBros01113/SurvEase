import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
});

// Forms Table
export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  tags: text("tags").array().notNull(),
  createdBy: integer("created_by").notNull(),
  estimatedTime: integer("estimated_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFormSchema = createInsertSchema(forms).omit({
  id: true,
  createdAt: true,
});

// Completions Table
export const completions = pgTable("completions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull(),
  userId: integer("user_id").notNull(),
  rating: integer("rating"),
  feedback: text("feedback"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const insertCompletionSchema = createInsertSchema(completions).omit({
  id: true,
  completedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof forms.$inferSelect;

export type InsertCompletion = z.infer<typeof insertCompletionSchema>;
export type Completion = typeof completions.$inferSelect;

// Extended Types for Frontend
export type FormWithStats = Form & {
  rating: number;
  reviewCount: number;
  isCompleted?: boolean;
  status?: 'new' | 'popular' | 'completed';
};

export type UserStats = {
  totalFilled: number;
  last7Days: number;
  last30Days: number;
  formsPosted: number;
  avgRating: number;
};

export type UserWithStats = User & {
  stats: UserStats;
};

export type ActivityData = {
  date: string;
  count: number;
};

export type RecentActivity = {
  id: number;
  formId: number;
  formTitle: string;
  activityType: 'completed' | 'posted';
  rating?: number;
  feedback?: string;
  date: string;
};
