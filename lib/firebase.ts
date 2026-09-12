// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics, Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every((value) => typeof value === "string" && value.trim().length > 0);

// Initialize Firebase (singleton pattern)
let app!: FirebaseApp;
let auth!: Auth;
let db!: Firestore;
let analytics: Analytics | null = null;
let secondaryAuth!: Auth;

if (hasFirebaseConfig) {
  if (typeof window !== "undefined") {
    // Only initialize on client side
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      // Initialize a secondary app for admin actions (like creating users without logout)
      const secondaryApp = initializeApp(firebaseConfig, "secondary");
      secondaryAuth = getAuth(secondaryApp);
    } else {
      app = getApps()[0];
      const secondaryApp = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
      secondaryAuth = getAuth(secondaryApp);
    }

    auth = getAuth(app);
    db = getFirestore(app);

    // Enable offline persistence for Firestore
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
      } else if (err.code === "unimplemented") {
        console.warn("The current browser does not support all of the features required to enable persistence");
      }
    });

    // Initialize Analytics only on client
    analytics = getAnalytics(app);
  } else {
    // Server-side initialization (minimal)
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      const secondaryApp = initializeApp(firebaseConfig, "secondary");
      secondaryAuth = getAuth(secondaryApp);
    } else {
      app = getApps()[0];
      const secondaryApp = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
      secondaryAuth = getAuth(secondaryApp);
    }
    auth = getAuth(app);
    db = getFirestore(app);
  }
} else {
  console.warn(
    "Firebase environment variables are not configured. Firebase services will be unavailable until NEXT_PUBLIC_FIREBASE_* vars are set."
  );
}

export { app, auth, db, analytics, secondaryAuth, hasFirebaseConfig };