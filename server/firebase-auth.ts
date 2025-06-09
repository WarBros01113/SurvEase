import { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebase-admin';
import { firebaseServerStorage } from './firebase-storage';

// Middleware to verify Firebase token
export async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Get user profile from Firestore
    const userProfile = await firebaseServerStorage.getUser(decodedToken.uid);
    
    if (!userProfile) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user to request
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email || '',
      ...userProfile
    };

    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Optional auth middleware (doesn't fail if no token)
export async function optionalFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      
      const userProfile = await firebaseServerStorage.getUser(decodedToken.uid);
      
      if (userProfile) {
        req.user = {
          id: decodedToken.uid,
          email: decodedToken.email || '',
          ...userProfile
        };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}