import { users, forms, completions, type User, type InsertUser, type Form, type InsertForm, type Completion, type InsertCompletion, type FormWithStats, type UserStats, type UserWithStats, type RecentActivity } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { subDays } from "date-fns";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, desc, gte, like, inArray, or, count } from "drizzle-orm";
import postgres from "postgres";
import connectPg from "connect-pg-simple";

// Define a compatible session store type
type SessionStore = any;

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Create postgres client
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString as string);
const db = drizzle(client);

// Modify the interface with any CRUD methods you might need
export interface IStorage {
  // User Methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserWithStats(userId: number): Promise<UserWithStats | undefined>;
  
  // Form Methods
  getForms(filters?: { tags?: string[], search?: string, completed?: boolean, userId?: number }): Promise<FormWithStats[]>;
  getForm(id: number): Promise<Form | undefined>;
  createForm(form: InsertForm): Promise<Form>;
  updateForm(id: number, form: Partial<InsertForm>): Promise<Form | undefined>;
  deleteForm(id: number): Promise<boolean>;
  
  // Completion Methods
  getCompletions(userId: number): Promise<Completion[]>;
  getCompletion(formId: number, userId: number): Promise<Completion | undefined>;
  markFormAsCompleted(completion: InsertCompletion): Promise<Completion>;
  getRecentActivities(userId: number, limit?: number): Promise<RecentActivity[]>;
  
  // Stats
  getUserStats(userId: number): Promise<UserStats>;
  getActivityData(userId: number, days: number): Promise<{ date: string, count: number }[]>;
  
  // Session
  sessionStore: SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private forms: Map<number, Form>;
  private completions: Map<number, Completion>;
  
  sessionStore: SessionStore;
  currentUserId: number;
  currentFormId: number;
  currentCompletionId: number;

  constructor() {
    this.users = new Map();
    this.forms = new Map();
    this.completions = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24h
    });
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentCompletionId = 1;
    
    // Create a test user for demonstration purposes
    this.createTestUser();
  }
  
  // Create a test user with a known password
  private async createTestUser() {
    const testUser: User = {
      id: this.currentUserId++,
      username: "demo",
      password: "fbd2c77e6a3fa73e6753042d93b8d5f29da8f2c3c1c4c5a96c968d5585587238cbea2a5a0f9991e36ca4fc68997a1fb1140e9e2a8e9620a77b9adabd1c6ef8a9.59b4e5bdd85c4265fc5e688c6e3b5988", // "password"
      email: "demo@example.com",
      fullName: "Demo User",
    };
    
    this.users.set(testUser.id, testUser);
    console.log("Test user created with username: 'demo' and password: 'password'");
    
    // Also create some sample forms
    this.createSampleForms(testUser.id);
  }
  
  // Create some sample forms for the test user
  private createSampleForms(userId: number) {
    const sampleForms = [
      {
        title: "Student Feedback Survey",
        description: "Help us improve our courses by providing your feedback on your learning experience.",
        url: "https://docs.google.com/forms/d/e/1FAIpQLSfCxcEbZhKj4-Cxz9N3X4Q2g1KZ1RJZ9n5_OTRnHMUyHnD2Mw/viewform",
        tags: ["Academic", "Student Feedback", "Education"],
        estimatedTime: 5,
        createdBy: userId,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      },
      {
        title: "Product User Experience Survey",
        description: "Share your experience with our product to help us enhance user satisfaction.",
        url: "https://docs.google.com/forms/d/e/1FAIpQLSdBq8Bh8NQ-9zzW2QiGXgmTSXFL_81ZTcWLrS9URhO8o_dY2g/viewform",
        tags: ["Product Testing", "User Experience", "Market Research"],
        estimatedTime: 8,
        createdBy: userId,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      },
      {
        title: "Health & Wellness Assessment",
        description: "Complete this survey to help us understand your health and wellness needs better.",
        url: "https://docs.google.com/forms/d/e/1FAIpQLSeZtWyK-wQYQpriN36ZnFoCqOsJ2GjkWG4JMx0kXJFtM0Z_Uw/viewform",
        tags: ["Health & Wellness", "Personal", "Lifestyle"],
        estimatedTime: 10,
        createdBy: userId,
        createdAt: new Date()
      }
    ];
    
    sampleForms.forEach(form => {
      const id = this.currentFormId++;
      this.forms.set(id, { ...form, id });
    });
    
    console.log("Sample forms created");
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getUserWithStats(userId: number): Promise<UserWithStats | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const stats = await this.getUserStats(userId);
    return {
      ...user,
      stats
    };
  }

  // Form Methods
  async getForms(filters?: { tags?: string[], search?: string, completed?: boolean, userId?: number }): Promise<FormWithStats[]> {
    let forms = Array.from(this.forms.values());
    
    // Apply filters
    if (filters) {
      if (filters.tags && filters.tags.length > 0) {
        forms = forms.filter(form => 
          filters.tags!.some(tag => form.tags.includes(tag))
        );
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        forms = forms.filter(form => 
          form.title.toLowerCase().includes(search) || 
          form.description.toLowerCase().includes(search)
        );
      }
      
      if (filters.userId !== undefined) {
        forms = forms.filter(form => form.createdBy === filters.userId);
      }
    }
    
    // Convert to FormWithStats
    const formsWithStats = await Promise.all(forms.map(async form => {
      const formCompletions = Array.from(this.completions.values())
        .filter(c => c.formId === form.id);
      
      const ratings = formCompletions
        .filter(c => c.rating !== undefined && c.rating !== null)
        .map(c => c.rating!);
      
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
        : 0;
      
      const isCompleted = filters?.userId !== undefined
        ? formCompletions.some(c => c.userId === filters.userId)
        : undefined;
      
      // Determine status
      let status: 'new' | 'popular' | 'completed' | undefined;
      
      if (isCompleted) {
        status = 'completed';
      } else if (formCompletions.length > 20) { // Arbitrary threshold for 'popular'
        status = 'popular';
      } else if (new Date().getTime() - new Date(form.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000) { // Within a week
        status = 'new';
      }
      
      return {
        ...form,
        rating: avgRating,
        reviewCount: ratings.length,
        isCompleted,
        status
      };
    }));
    
    return formsWithStats;
  }

  async getForm(id: number): Promise<Form | undefined> {
    return this.forms.get(id);
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const id = this.currentFormId++;
    const form: Form = { 
      ...insertForm, 
      id, 
      createdAt: new Date() 
    };
    this.forms.set(id, form);
    return form;
  }

  async updateForm(id: number, formUpdate: Partial<InsertForm>): Promise<Form | undefined> {
    const existingForm = this.forms.get(id);
    if (!existingForm) return undefined;
    
    const updatedForm = { ...existingForm, ...formUpdate };
    this.forms.set(id, updatedForm);
    return updatedForm;
  }

  async deleteForm(id: number): Promise<boolean> {
    return this.forms.delete(id);
  }

  // Completion Methods
  async getCompletions(userId: number): Promise<Completion[]> {
    return Array.from(this.completions.values())
      .filter(completion => completion.userId === userId);
  }

  async getCompletion(formId: number, userId: number): Promise<Completion | undefined> {
    return Array.from(this.completions.values())
      .find(completion => completion.formId === formId && completion.userId === userId);
  }

  async markFormAsCompleted(insertCompletion: InsertCompletion): Promise<Completion> {
    // Check if already completed
    const existing = await this.getCompletion(insertCompletion.formId, insertCompletion.userId);
    if (existing) {
      // Update existing completion
      const updatedCompletion = { 
        ...existing, 
        rating: insertCompletion.rating,
        feedback: insertCompletion.feedback,
        completedAt: new Date() 
      };
      this.completions.set(existing.id, updatedCompletion);
      return updatedCompletion;
    }
    
    // Create new completion
    const id = this.currentCompletionId++;
    const completion: Completion = { 
      ...insertCompletion, 
      id, 
      completedAt: new Date() 
    };
    this.completions.set(id, completion);
    return completion;
  }

  async getRecentActivities(userId: number, limit: number = 10): Promise<RecentActivity[]> {
    const userCompletions = Array.from(this.completions.values())
      .filter(completion => completion.userId === userId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, limit);
    
    const userForms = Array.from(this.forms.values())
      .filter(form => form.createdBy === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    
    const completionActivities: RecentActivity[] = await Promise.all(
      userCompletions.map(async completion => {
        const form = await this.getForm(completion.formId);
        return {
          id: completion.id,
          formId: completion.formId,
          formTitle: form?.title || 'Unknown Form',
          activityType: 'completed',
          rating: completion.rating,
          feedback: completion.feedback,
          date: completion.completedAt.toISOString()
        };
      })
    );
    
    const formActivities: RecentActivity[] = userForms.map(form => ({
      id: form.id,
      formId: form.id,
      formTitle: form.title,
      activityType: 'posted',
      date: form.createdAt.toISOString()
    }));
    
    // Combine and sort
    return [...completionActivities, ...formActivities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  // Stats Methods
  async getUserStats(userId: number): Promise<UserStats> {
    const allCompletions = Array.from(this.completions.values())
      .filter(completion => completion.userId === userId);
    
    const now = new Date();
    const last7Days = subDays(now, 7);
    const last30Days = subDays(now, 30);
    
    const completionsLast7Days = allCompletions.filter(
      completion => new Date(completion.completedAt) >= last7Days
    );
    
    const completionsLast30Days = allCompletions.filter(
      completion => new Date(completion.completedAt) >= last30Days
    );
    
    const formsPosted = Array.from(this.forms.values())
      .filter(form => form.createdBy === userId).length;
    
    // Calculate average rating for posted forms
    const userForms = Array.from(this.forms.values())
      .filter(form => form.createdBy === userId);
    
    let totalRating = 0;
    let ratedCompletionsCount = 0;
    
    for (const form of userForms) {
      const formCompletions = Array.from(this.completions.values())
        .filter(c => c.formId === form.id && c.rating !== undefined && c.rating !== null);
      
      formCompletions.forEach(c => {
        totalRating += c.rating!;
        ratedCompletionsCount++;
      });
    }
    
    const avgRating = ratedCompletionsCount > 0 ? totalRating / ratedCompletionsCount : 0;
    
    return {
      totalFilled: allCompletions.length,
      last7Days: completionsLast7Days.length,
      last30Days: completionsLast30Days.length,
      formsPosted,
      avgRating
    };
  }

  async getActivityData(userId: number, days: number = 90): Promise<{ date: string, count: number }[]> {
    const userCompletions = Array.from(this.completions.values())
      .filter(completion => completion.userId === userId);
    
    const startDate = subDays(new Date(), days);
    const result: { [date: string]: number } = {};
    
    // Initialize all dates in range with 0
    for (let i = 0; i <= days; i++) {
      const date = subDays(new Date(), i);
      const dateStr = date.toISOString().split('T')[0];
      result[dateStr] = 0;
    }
    
    // Count completions per day
    userCompletions.forEach(completion => {
      const dateStr = new Date(completion.completedAt).toISOString().split('T')[0];
      if (new Date(dateStr) >= startDate) {
        result[dateStr] = (result[dateStr] || 0) + 1;
      }
    });
    
    // Convert to array and sort by date
    return Object.entries(result)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: client,
      createTableIfMissing: true
    });
  }

  // Create database tables using drizzle push
  async pushSchema() {
    try {
      console.log("Setting up database tables...");
      // Database tables are created through drizzle push
      console.log("Database setup complete");
    } catch (error) {
      console.error("Error setting up database:", error);
    }
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getUserWithStats(userId: number): Promise<UserWithStats | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const stats = await this.getUserStats(userId);
    return {
      ...user,
      stats
    };
  }

  // Form Methods
  async getForms(filters?: { tags?: string[], search?: string, completed?: boolean, userId?: number }): Promise<FormWithStats[]> {
    let query = db.select().from(forms);
    
    // Apply filters
    if (filters) {
      if (filters.userId !== undefined) {
        query = query.where(eq(forms.createdBy, filters.userId));
      }
      
      if (filters.search) {
        query = query.where(
          or(
            like(forms.title, `%${filters.search}%`),
            like(forms.description, `%${filters.search}%`)
          )
        );
      }
      
      // Tags filtering is more complex with array columns
      // We'll handle this after getting the initial results
    }
    
    const allForms = await query;
    
    // Filter by tags if needed
    let filteredForms = allForms;
    if (filters?.tags && filters.tags.length > 0) {
      filteredForms = allForms.filter(form => 
        filters.tags!.some(tag => form.tags.includes(tag))
      );
    }
    
    // Get completions for forms
    const formIds = filteredForms.map(form => form.id);
    
    let completionResults: Completion[] = [];
    if (formIds.length > 0) {
      completionResults = await db.select()
        .from(completions)
        .where(inArray(completions.formId, formIds));
    }
    
    // Convert to FormWithStats
    const formsWithStats = await Promise.all(filteredForms.map(async form => {
      const formCompletions = completionResults.filter(c => c.formId === form.id);
      
      const ratings = formCompletions
        .filter(c => c.rating !== undefined && c.rating !== null)
        .map(c => c.rating!);
      
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
        : 0;
      
      const isCompleted = filters?.userId !== undefined
        ? formCompletions.some(c => c.userId === filters.userId)
        : undefined;
      
      // Determine status
      let status: 'new' | 'popular' | 'completed' | undefined;
      
      if (isCompleted) {
        status = 'completed';
      } else if (formCompletions.length > 20) { // Arbitrary threshold for 'popular'
        status = 'popular';
      } else if (new Date().getTime() - new Date(form.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000) { // Within a week
        status = 'new';
      }
      
      return {
        ...form,
        rating: avgRating,
        reviewCount: ratings.length,
        isCompleted,
        status
      };
    }));
    
    return formsWithStats;
  }

  async getForm(id: number): Promise<Form | undefined> {
    const result = await db.select().from(forms).where(eq(forms.id, id));
    return result[0];
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const result = await db.insert(forms).values(insertForm).returning();
    return result[0];
  }

  async updateForm(id: number, formUpdate: Partial<InsertForm>): Promise<Form | undefined> {
    const result = await db
      .update(forms)
      .set(formUpdate)
      .where(eq(forms.id, id))
      .returning();
      
    return result[0];
  }

  async deleteForm(id: number): Promise<boolean> {
    const result = await db
      .delete(forms)
      .where(eq(forms.id, id))
      .returning();
      
    return result.length > 0;
  }

  // Completion Methods
  async getCompletions(userId: number): Promise<Completion[]> {
    return db
      .select()
      .from(completions)
      .where(eq(completions.userId, userId));
  }

  async getCompletion(formId: number, userId: number): Promise<Completion | undefined> {
    const result = await db
      .select()
      .from(completions)
      .where(
        and(
          eq(completions.formId, formId),
          eq(completions.userId, userId)
        )
      );
      
    return result[0];
  }

  async markFormAsCompleted(insertCompletion: InsertCompletion): Promise<Completion> {
    // Check if already completed
    const existing = await this.getCompletion(insertCompletion.formId, insertCompletion.userId);
    
    if (existing) {
      // Update existing completion
      const result = await db
        .update(completions)
        .set({
          rating: insertCompletion.rating,
          feedback: insertCompletion.feedback,
          completedAt: new Date()
        })
        .where(eq(completions.id, existing.id))
        .returning();
        
      return result[0];
    }
    
    // Create new completion
    const result = await db
      .insert(completions)
      .values(insertCompletion)
      .returning();
      
    return result[0];
  }

  async getRecentActivities(userId: number, limit: number = 10): Promise<RecentActivity[]> {
    // Get user's completions
    const userCompletions = await db
      .select()
      .from(completions)
      .where(eq(completions.userId, userId))
      .orderBy(desc(completions.completedAt))
      .limit(limit);
    
    // Get user's forms
    const userForms = await db
      .select()
      .from(forms)
      .where(eq(forms.createdBy, userId))
      .orderBy(desc(forms.createdAt))
      .limit(limit);
    
    // Convert completions to activities
    const completionActivities: RecentActivity[] = await Promise.all(
      userCompletions.map(async completion => {
        const form = await this.getForm(completion.formId);
        return {
          id: completion.id,
          formId: completion.formId,
          formTitle: form?.title || 'Unknown Form',
          activityType: 'completed',
          rating: completion.rating,
          feedback: completion.feedback,
          date: completion.completedAt.toISOString()
        };
      })
    );
    
    // Convert forms to activities
    const formActivities: RecentActivity[] = userForms.map(form => ({
      id: form.id,
      formId: form.id,
      formTitle: form.title,
      activityType: 'posted',
      date: form.createdAt.toISOString()
    }));
    
    // Combine and sort
    return [...completionActivities, ...formActivities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  // Stats Methods
  async getUserStats(userId: number): Promise<UserStats> {
    // Get all user completions
    const allCompletions = await db
      .select()
      .from(completions)
      .where(eq(completions.userId, userId));
    
    const now = new Date();
    const last7Days = subDays(now, 7);
    const last30Days = subDays(now, 30);
    
    const completionsLast7Days = allCompletions.filter(
      completion => new Date(completion.completedAt) >= last7Days
    );
    
    const completionsLast30Days = allCompletions.filter(
      completion => new Date(completion.completedAt) >= last30Days
    );
    
    // Count forms posted by user
    const { count } = await db
      .select({ count: count() })
      .from(forms)
      .where(eq(forms.createdBy, userId))
      .then(rows => rows[0]);
    
    const formsPosted = Number(count) || 0;
    
    // Calculate average rating for posted forms
    const userForms = await db
      .select()
      .from(forms)
      .where(eq(forms.createdBy, userId));
    
    let totalRating = 0;
    let ratedCompletionsCount = 0;
    
    // Get all completions for user's forms
    const formIds = userForms.map(form => form.id);
    const formCompletions = formIds.length > 0 
      ? await db
          .select()
          .from(completions)
          .where(inArray(completions.formId, formIds))
      : [];
    
    // Calculate average rating
    formCompletions
      .filter(c => c.rating !== undefined && c.rating !== null)
      .forEach(c => {
        totalRating += c.rating!;
        ratedCompletionsCount++;
      });
    
    const avgRating = ratedCompletionsCount > 0 ? totalRating / ratedCompletionsCount : 0;
    
    return {
      totalFilled: allCompletions.length,
      last7Days: completionsLast7Days.length,
      last30Days: completionsLast30Days.length,
      formsPosted,
      avgRating
    };
  }

  async getActivityData(userId: number, days: number = 90): Promise<{ date: string, count: number }[]> {
    const startDate = subDays(new Date(), days);
    
    // Get completions within date range
    const userCompletions = await db
      .select()
      .from(completions)
      .where(
        and(
          eq(completions.userId, userId),
          gte(completions.completedAt, startDate)
        )
      );
    
    const result: { [date: string]: number } = {};
    
    // Initialize all dates in range with 0
    for (let i = 0; i <= days; i++) {
      const date = subDays(new Date(), i);
      const dateStr = date.toISOString().split('T')[0];
      result[dateStr] = 0;
    }
    
    // Count completions per day
    userCompletions.forEach(completion => {
      const dateStr = new Date(completion.completedAt).toISOString().split('T')[0];
      result[dateStr] = (result[dateStr] || 0) + 1;
    });
    
    // Convert to array and sort by date
    return Object.entries(result)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Helper method to seed initial data (demo user and forms)
  async seedInitialData() {
    try {
      // Check if we already have users
      const existingUsers = await db.select().from(users);
      
      if (existingUsers.length === 0) {
        console.log("Seeding initial demo data...");
        
        // Create demo user
        const demoUser = await this.createUser({
          username: "demo",
          password: "fbd2c77e6a3fa73e6753042d93b8d5f29da8f2c3c1c4c5a96c968d5585587238cbea2a5a0f9991e36ca4fc68997a1fb1140e9e2a8e9620a77b9adabd1c6ef8a9.59b4e5bdd85c4265fc5e688c6e3b5988", // "password"
          email: "demo@example.com",
          fullName: "Demo User",
        });
        
        console.log("Demo user created with username: 'demo' and password: 'password'");
        
        // Create sample forms
        const sampleForms = [
          {
            title: "Student Feedback Survey",
            description: "Help us improve our courses by providing your feedback on your learning experience.",
            url: "https://docs.google.com/forms/d/e/1FAIpQLSfCxcEbZhKj4-Cxz9N3X4Q2g1KZ1RJZ9n5_OTRnHMUyHnD2Mw/viewform",
            tags: ["Academic", "Student Feedback", "Education"],
            estimatedTime: 5,
            createdBy: demoUser.id,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          },
          {
            title: "Product User Experience Survey",
            description: "Share your experience with our product to help us enhance user satisfaction.",
            url: "https://docs.google.com/forms/d/e/1FAIpQLSdBq8Bh8NQ-9zzW2QiGXgmTSXFL_81ZTcWLrS9URhO8o_dY2g/viewform",
            tags: ["Product Testing", "User Experience", "Market Research"],
            estimatedTime: 8,
            createdBy: demoUser.id,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
          },
          {
            title: "Health & Wellness Assessment",
            description: "Complete this survey to help us understand your health and wellness needs better.",
            url: "https://docs.google.com/forms/d/e/1FAIpQLSeZtWyK-wQYQpriN36ZnFoCqOsJ2GjkWG4JMx0kXJFtM0Z_Uw/viewform",
            tags: ["Health & Wellness", "Personal", "Lifestyle"],
            estimatedTime: 10,
            createdBy: demoUser.id,
            createdAt: new Date()
          }
        ];
        
        for (const formData of sampleForms) {
          await this.createForm(formData);
        }
        
        console.log("Sample forms created");
      } else {
        console.log("Database already has users, skipping demo data creation");
      }
    } catch (error) {
      console.error("Error seeding initial data:", error);
    }
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
