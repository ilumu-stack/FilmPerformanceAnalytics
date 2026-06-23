import { initializeApp, getApps } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getAuth } from "firebase/auth"

// Firebase web config is not secret (it's shipped to every browser and
// restricted via Firebase Security Rules / API key restrictions, not by
// hiding it) — but it's still env-driven so each environment/clone can
// point at its own Firebase project. Set these in frontend/.env.local.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Prevent re-initializing on hot reloads (Next.js dev mode)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

// Firebase Auth instance (singleton)
const firebaseAuth = getAuth(app)

// Analytics is browser-only — guard against SSR
const analyticsPromise = isSupported().then((yes) => (yes ? getAnalytics(app) : null))

export { app, firebaseAuth, analyticsPromise }
