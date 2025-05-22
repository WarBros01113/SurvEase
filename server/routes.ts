import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertFormSchema, insertCompletionSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Forms API
  app.get("/api/forms", async (req, res) => {
    try {
      const { tags, search, userId } = req.query;
      
      const filters: any = {};
      
      if (tags) {
        filters.tags = (tags as string).split(",");
      }
      
      if (search) {
        filters.search = search as string;
      }
      
      // If userId is provided, get forms created by that user
      if (userId) {
        filters.userId = parseInt(userId as string);
      }
      
      // If user is logged in, include completion status
      if (req.isAuthenticated()) {
        filters.completed = req.user?.id;
      }
      
      const forms = await storage.getForms(filters);
      res.json(forms);
    } catch (error) {
      console.error("Error fetching forms:", error);
      res.status(500).json({ message: "Failed to fetch forms" });
    }
  });

  app.get("/api/forms/:id", async (req, res) => {
    try {
      const formId = parseInt(req.params.id);
      const form = await storage.getForm(formId);
      
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      
      res.json(form);
    } catch (error) {
      console.error("Error fetching form:", error);
      res.status(500).json({ message: "Failed to fetch form" });
    }
  });

  app.post("/api/forms", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const validatedData = insertFormSchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
      const form = await storage.createForm(validatedData);
      res.status(201).json(form);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid form data", errors: error.errors });
      } else {
        console.error("Error creating form:", error);
        res.status(500).json({ message: "Failed to create form" });
      }
    }
  });

  app.put("/api/forms/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const formId = parseInt(req.params.id);
      const form = await storage.getForm(formId);
      
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      
      if (form.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const validatedData = insertFormSchema.partial().parse(req.body);
      const updatedForm = await storage.updateForm(formId, validatedData);
      
      res.json(updatedForm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid form data", errors: error.errors });
      } else {
        console.error("Error updating form:", error);
        res.status(500).json({ message: "Failed to update form" });
      }
    }
  });

  app.delete("/api/forms/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const formId = parseInt(req.params.id);
      const form = await storage.getForm(formId);
      
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      
      if (form.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      await storage.deleteForm(formId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting form:", error);
      res.status(500).json({ message: "Failed to delete form" });
    }
  });

  // Form Completions API
  app.post("/api/forms/:id/complete", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const formId = parseInt(req.params.id);
      const form = await storage.getForm(formId);
      
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      
      const validatedData = insertCompletionSchema.parse({
        formId,
        userId: req.user.id,
        rating: req.body.rating,
        feedback: req.body.feedback
      });
      
      const completion = await storage.markFormAsCompleted(validatedData);
      res.status(201).json(completion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid completion data", errors: error.errors });
      } else {
        console.error("Error completing form:", error);
        res.status(500).json({ message: "Failed to complete form" });
      }
    }
  });

  // User Stats API
  app.get("/api/user/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const stats = await storage.getUserStats(req.user.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get("/api/user/activity", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const days = req.query.days ? parseInt(req.query.days as string) : 90;
      const activity = await storage.getActivityData(req.user.id, days);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity data:", error);
      res.status(500).json({ message: "Failed to fetch activity data" });
    }
  });

  app.get("/api/user/activities", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getRecentActivities(req.user.id, limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  app.get("/api/user/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userWithStats = await storage.getUserWithStats(req.user.id);
      if (!userWithStats) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(userWithStats);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
