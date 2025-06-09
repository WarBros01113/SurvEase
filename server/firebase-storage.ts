import { adminDb, adminAuth } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { FormWithStats, UserStats, RecentActivity } from '@shared/schema';

export class FirebaseServerStorage {
  // User Methods
  async getUser(uid: string): Promise<any> {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        return { id: uid, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<any> {
    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
      
      if (userDoc.exists) {
        return { id: userRecord.uid, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  async createUser(userData: any): Promise<any> {
    try {
      const userRecord = await adminAuth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.fullName,
      });

      const userProfile = {
        uid: userRecord.uid,
        email: userData.email,
        fullName: userData.fullName,
        username: userData.username,
        createdAt: FieldValue.serverTimestamp(),
        stats: {
          totalFilled: 0,
          formsPosted: 0,
          avgRating: 0
        }
      };

      await adminDb.collection('users').doc(userRecord.uid).set(userProfile);
      
      return { id: userRecord.uid, ...userProfile };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Forms Methods
  async getForms(filters?: { tags?: string[], search?: string, userId?: string }): Promise<FormWithStats[]> {
    try {
      let query = adminDb.collection('forms').orderBy('createdAt', 'desc');
      
      if (filters?.userId) {
        query = adminDb.collection('forms')
          .where('createdBy', '==', filters.userId)
          .orderBy('createdAt', 'desc');
      }
      
      const snapshot = await query.get();
      let forms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      })) as FormWithStats[];

      // Apply client-side filters
      if (filters?.tags && filters.tags.length > 0) {
        forms = forms.filter(form => 
          filters.tags!.some(tag => form.tags?.includes(tag))
        );
      }

      if (filters?.search) {
        const search = filters.search.toLowerCase();
        forms = forms.filter(form => 
          form.title?.toLowerCase().includes(search) || 
          form.description?.toLowerCase().includes(search)
        );
      }

      // Add completion status for each form if userId is provided
      if (filters?.userId) {
        const completions = await this.getUserCompletions(filters.userId);
        const completedFormIds = new Set(completions.map(c => c.formId));
        
        forms = forms.map(form => ({
          ...form,
          isCompleted: completedFormIds.has(form.id),
          status: completedFormIds.has(form.id) ? 'completed' : 
                  (form.reviewCount > 20 ? 'popular' : 
                   (Date.now() - form.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000 ? 'new' : undefined))
        }));
      }

      return forms;
    } catch (error) {
      console.error('Error fetching forms:', error);
      throw error;
    }
  }

  async getForm(formId: string): Promise<any> {
    try {
      const doc = await adminDb.collection('forms').doc(formId).get();
      if (doc.exists) {
        return {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data()?.createdAt?.toDate?.() || new Date()
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching form:', error);
      throw error;
    }
  }

  async createForm(formData: any): Promise<any> {
    try {
      const docRef = await adminDb.collection('forms').add({
        ...formData,
        createdAt: FieldValue.serverTimestamp(),
        rating: 0,
        reviewCount: 0
      });
      
      const newForm = await this.getForm(docRef.id);
      return newForm;
    } catch (error) {
      console.error('Error creating form:', error);
      throw error;
    }
  }

  async updateForm(formId: string, updates: any): Promise<any> {
    try {
      await adminDb.collection('forms').doc(formId).update(updates);
      return await this.getForm(formId);
    } catch (error) {
      console.error('Error updating form:', error);
      throw error;
    }
  }

  async deleteForm(formId: string): Promise<boolean> {
    try {
      await adminDb.collection('forms').doc(formId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting form:', error);
      return false;
    }
  }

  // Completions Methods
  async markFormAsCompleted(formId: string, userId: string, rating?: number, feedback?: string): Promise<any> {
    try {
      // Check if already completed
      const existingQuery = await adminDb.collection('completions')
        .where('formId', '==', formId)
        .where('userId', '==', userId)
        .get();
      
      if (!existingQuery.empty) {
        // Update existing completion
        const doc = existingQuery.docs[0];
        await doc.ref.update({
          rating,
          feedback,
          completedAt: FieldValue.serverTimestamp()
        });
        
        return {
          id: doc.id,
          formId,
          userId,
          rating,
          feedback
        };
      } else {
        // Create new completion
        const docRef = await adminDb.collection('completions').add({
          formId,
          userId,
          rating,
          feedback,
          completedAt: FieldValue.serverTimestamp()
        });

        // Update form stats if rating provided
        if (rating) {
          await adminDb.collection('forms').doc(formId).update({
            reviewCount: FieldValue.increment(1)
          });
        }

        return {
          id: docRef.id,
          formId,
          userId,
          rating,
          feedback
        };
      }
    } catch (error) {
      console.error('Error marking form as completed:', error);
      throw error;
    }
  }

  async getUserCompletions(userId: string): Promise<any[]> {
    try {
      const snapshot = await adminDb.collection('completions')
        .where('userId', '==', userId)
        .orderBy('completedAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate?.() || new Date()
      }));
    } catch (error) {
      console.error('Error fetching user completions:', error);
      throw error;
    }
  }

  // Stats Methods
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const completions = await this.getUserCompletions(userId);
      const userForms = await this.getForms({ userId });

      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const completionsLast7Days = completions.filter(
        completion => new Date(completion.completedAt) >= last7Days
      );

      const completionsLast30Days = completions.filter(
        completion => new Date(completion.completedAt) >= last30Days
      );

      // Calculate average rating for user's forms
      let totalRating = 0;
      let ratedCount = 0;

      for (const form of userForms) {
        if (form.rating && form.reviewCount > 0) {
          totalRating += form.rating * form.reviewCount;
          ratedCount += form.reviewCount;
        }
      }

      const avgRating = ratedCount > 0 ? totalRating / ratedCount : 0;

      return {
        totalFilled: completions.length,
        last7Days: completionsLast7Days.length,
        last30Days: completionsLast30Days.length,
        formsPosted: userForms.length,
        avgRating
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  async getRecentActivities(userId: string, limitCount: number = 10): Promise<RecentActivity[]> {
    try {
      const completions = await this.getUserCompletions(userId);
      const userForms = await this.getForms({ userId });

      const completionActivities: RecentActivity[] = await Promise.all(
        completions.slice(0, limitCount).map(async completion => {
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

      const formActivities: RecentActivity[] = userForms.slice(0, limitCount).map(form => ({
        id: form.id,
        formId: form.id,
        formTitle: form.title,
        activityType: 'posted',
        date: form.createdAt.toISOString()
      }));

      return [...completionActivities, ...formActivities]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      throw error;
    }
  }

  async getActivityData(userId: string, days: number = 90): Promise<{ date: string, count: number }[]> {
    try {
      const completions = await this.getUserCompletions(userId);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const result: { [date: string]: number } = {};
      
      // Initialize all dates in range with 0
      for (let i = 0; i <= days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        result[dateStr] = 0;
      }
      
      // Count completions per day
      completions.forEach(completion => {
        const dateStr = new Date(completion.completedAt).toISOString().split('T')[0];
        if (new Date(dateStr) >= startDate) {
          result[dateStr] = (result[dateStr] || 0) + 1;
        }
      });
      
      // Convert to array and sort by date
      return Object.entries(result)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error fetching activity data:', error);
      throw error;
    }
  }

  // Seed test data
  async seedTestData(): Promise<void> {
    try {
      console.log('Seeding Firebase test data...');
      
      // Create test user
      const testUser = await this.createUser({
        email: 'demo@survease.com',
        password: 'password123',
        fullName: 'Demo User',
        username: 'demo'
      });

      console.log('Test user created:', testUser.email);

      // Create sample forms
      const sampleForms = [
        {
          title: "Student Feedback Survey",
          description: "Help us improve our courses by providing your feedback on your learning experience.",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSfCxcEbZhKj4-Cxz9N3X4Q2g1KZ1RJZ9n5_OTRnHMUyHnD2Mw/viewform",
          tags: ["Academic", "Student Feedback", "Education"],
          estimatedTime: 5,
          createdBy: testUser.id
        },
        {
          title: "Product User Experience Survey",
          description: "Share your experience with our product to help us enhance user satisfaction.",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSdBq8Bh8NQ-9zzW2QiGXgmTSXFL_81ZTcWLrS9URhO8o_dY2g/viewform",
          tags: ["Product Testing", "User Experience", "Market Research"],
          estimatedTime: 8,
          createdBy: testUser.id
        },
        {
          title: "Health & Wellness Assessment",
          description: "Complete this survey to help us understand your health and wellness needs better.",
          url: "https://docs.google.com/forms/d/e/1FAIpQLSeZtWyK-wQYQpriN36ZnFoCqOsJ2GjkWG4JMx0kXJFtM0Z_Uw/viewform",
          tags: ["Health & Wellness", "Personal", "Lifestyle"],
          estimatedTime: 10,
          createdBy: testUser.id
        }
      ];

      for (const formData of sampleForms) {
        const form = await this.createForm(formData);
        console.log('Created form:', form.title);
        
        // Add some sample completions
        await this.markFormAsCompleted(form.id, testUser.id, Math.floor(Math.random() * 5) + 1, 'Great form!');
      }

      console.log('Firebase test data seeded successfully!');
    } catch (error) {
      console.error('Error seeding test data:', error);
    }
  }
}

export const firebaseServerStorage = new FirebaseServerStorage();