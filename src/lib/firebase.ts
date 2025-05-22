
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

let app: FirebaseApp | null = null; // Initialize app as potentially null
let db: ReturnType<typeof getFirestore> | null = null; // Initialize db as potentially null

// Check if all required config values are present
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0 && typeof window !== 'undefined') { // Only log/error in client-side
  console.error(
    `Firebase configuration is missing: ${missingKeys.join(', ')}. ` +
    `Please ensure these are correctly set in your .env.local file at the project root ` +
    `and that you have RESTARTED your Next.js development server after changes.`
  );
  // app will remain null, and db will remain null if config is missing
}


if (!getApps().length) {
  // Only attempt to initialize if config keys are present
  if (missingKeys.length === 0) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Firebase initialization error:", e);
      app = null; // Ensure app is null if initialization fails
    }
  }
} else {
  app = getApps()[0];
}

if (app) {
  try {
    db = getFirestore(app);
  } catch (e) {
    console.error("Firestore initialization error:", e);
    db = null; // Ensure db is null if getFirestore fails
  }
}

// Export a getter for db to ensure it's only used if initialized
const getDb = () => {
  if (!db && missingKeys.length === 0 && typeof window !== 'undefined') {
     // This additional warning is if db is null even if config keys were supposedly present
     // It might indicate an issue during initializeApp or getFirestore that wasn't a config key issue.
     console.warn("Firestore is not available. Firebase app might have initialized, but Firestore could not be accessed.");
  } else if (!db && missingKeys.length > 0 && typeof window !== 'undefined') {
    // This reiterates the primary problem if db is null due to missing keys
    // console.warn("Firestore is not available due to missing Firebase configuration. Please check .env.local and restart your server.");
    // This specific console.warn might be redundant given the earlier console.error, so commented out for now.
  }
  return db;
}

export { getDb, app };
