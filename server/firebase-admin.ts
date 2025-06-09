import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
let app;
if (getApps().length === 0) {
  // For development, we'll use the default credentials
  // In production, you should use a service account key
  app = initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'survease-6d14e',
  });
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

export default app;