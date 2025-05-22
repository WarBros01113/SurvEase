import { users, forms, completions, type User, type InsertUser, type Form, type InsertForm, type Completion, type InsertCompletion, type FormWithStats, type UserStats, type UserWithStats, type RecentActivity } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { subDays } from "date-fns";

// Define a compatible session store type
type SessionStore = ReturnType<typeof createMemoryStore>;

const MemoryStore = createMemoryStore(session);

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

export const storage = new MemStorage();
