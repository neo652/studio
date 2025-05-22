
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let app: FirebaseApp;

// Check if all required config values are present
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0 && typeof window !== 'undefined') { // Only log/error in client-side
  console.error(
    `Firebase configuration is missing: ${missingKeys.join(', ')}. Please set them in your .env.local file.`
  );
  // You might want to throw an error here or disable Firebase-dependent features
  // For now, we'll let it try to initialize, which might fail gracefully or not.
}


if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase initialization error:", e);
    // Fallback or rethrow, depending on how critical Firebase is at this stage
    // For this app, Firestore is optional, so we might not want to break the app
    // @ts-ignore
    app = null; // Indicate that app initialization failed
  }
} else {
  app = getApps()[0];
}

// @ts-ignore
const db = app ? getFirestore(app) : null; // Initialize db only if app was initialized

// Export a getter for db to ensure it's only used if initialized
const getDb = () => {
  if (!db) {
    if (typeof window !== 'undefined') { // Avoid server-side console logs for this warning
       console.warn("Firestore is not initialized. Firebase config might be missing or invalid.");
    }
  }
  return db;
}

export { getDb, app };
