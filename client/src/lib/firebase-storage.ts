import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FormWithStats, UserStats, RecentActivity } from "@shared/schema";

export class FirebaseStorage {
  // Forms Methods
  async createForm(formData: any, userId: string): Promise<any> {
    try {
      const docRef = await addDoc(collection(db, 'forms'), {
        ...formData,
        createdBy: userId,
        createdAt: Timestamp.now(),
        rating: 0,
        reviewCount: 0
      });
      
      return { id: docRef.id, ...formData };
    } catch (error) {
      console.error("Error creating form:", error);
      throw error;
    }
  }

  async getForms(filters?: { tags?: string[], search?: string, userId?: string }): Promise<FormWithStats[]> {
    try {
      let q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
      
      if (filters?.userId) {
        q = query(collection(db, 'forms'), where('createdBy', '==', filters.userId), orderBy('createdAt', 'desc'));
      }
      
      const querySnapshot = await getDocs(q);
      let forms = querySnapshot.docs.map(doc => ({
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

      return forms;
    } catch (error) {
      console.error("Error fetching forms:", error);
      throw error;
    }
  }

  async getForm(formId: string): Promise<any> {
    try {
      const docRef = doc(db, 'forms', formId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.() || new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching form:", error);
      throw error;
    }
  }

  async updateForm(formId: string, updates: any): Promise<any> {
    try {
      const docRef = doc(db, 'forms', formId);
      await updateDoc(docRef, updates);
      return await this.getForm(formId);
    } catch (error) {
      console.error("Error updating form:", error);
      throw error;
    }
  }

  async deleteForm(formId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'forms', formId));
      return true;
    } catch (error) {
      console.error("Error deleting form:", error);
      return false;
    }
  }

  // Completions Methods
  async markFormAsCompleted(formId: string, userId: string, rating?: number, feedback?: string): Promise<any> {
    try {
      // Check if already completed
      const completionsQuery = query(
        collection(db, 'completions'),
        where('formId', '==', formId),
        where('userId', '==', userId)
      );
      
      const existingCompletions = await getDocs(completionsQuery);
      
      if (!existingCompletions.empty) {
        // Update existing completion
        const completionDoc = existingCompletions.docs[0];
        await updateDoc(doc(db, 'completions', completionDoc.id), {
          rating,
          feedback,
          completedAt: Timestamp.now()
        });
        
        return {
          id: completionDoc.id,
          ...completionDoc.data(),
          rating,
          feedback
        };
      } else {
        // Create new completion
        const docRef = await addDoc(collection(db, 'completions'), {
          formId,
          userId,
          rating,
          feedback,
          completedAt: Timestamp.now()
        });

        // Update form stats
        if (rating) {
          const formRef = doc(db, 'forms', formId);
          await updateDoc(formRef, {
            reviewCount: increment(1)
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
      console.error("Error marking form as completed:", error);
      throw error;
    }
  }

  async getUserCompletions(userId: string): Promise<any[]> {
    try {
      const q = query(
        collection(db, 'completions'),
        where('userId', '==', userId),
        orderBy('completedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate?.() || new Date()
      }));
    } catch (error) {
      console.error("Error fetching user completions:", error);
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
      console.error("Error fetching user stats:", error);
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
      console.error("Error fetching recent activities:", error);
      throw error;
    }
  }
}

export const firebaseStorage = new FirebaseStorage();