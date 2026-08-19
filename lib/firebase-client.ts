import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

/**
 * Browser-side Firebase. The config values are public by design (they identify
 * the project, they do not authorise anything) — access is decided by Firebase
 * Auth plus the Firestore rules, which deny every client write.
 */
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
};

/** Without a project id the app falls back to the local account mode. */
export function isFirebaseEnabled() {
  return Boolean(config.projectId && config.apiKey);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuthClient(): Auth | null {
  if (!isFirebaseEnabled()) return null;
  if (auth) return auth;

  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);

  const emulator = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR;
  if (emulator) {
    connectAuthEmulator(auth, emulator, { disableWarnings: true });
  }
  return auth;
}

/** Fresh ID token for the API call, or undefined when nobody is signed in. */
export async function getFirebaseIdToken(): Promise<string | undefined> {
  const client = getFirebaseAuthClient();
  const user = client?.currentUser;
  if (!user) return undefined;
  return user.getIdToken();
}
