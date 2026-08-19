import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, onAuthStateChanged, type Auth, type User } from "firebase/auth";

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

let authReady: Promise<void> | null = null;

/**
 * Firebase restores the previous session asynchronously after page load.
 * Without waiting for that first callback, the very first API request goes out
 * with no token, comes back 401, and the app silently falls back to local mode —
 * where a signature would look successful but reach nobody.
 */
function waitForAuthReady(client: Auth): Promise<void> {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(client, () => {
        unsubscribe();
        resolve();
      });
    });
  }
  return authReady;
}

/** Fresh ID token for the API call, or undefined when nobody is signed in. */
export async function getFirebaseIdToken(): Promise<string | undefined> {
  const client = getFirebaseAuthClient();
  if (!client) return undefined;
  await waitForAuthReady(client);
  const user = client.currentUser;
  if (!user) return undefined;
  return user.getIdToken();
}

/** Lets the app refetch as soon as sign-in or sign-out actually takes effect. */
export function subscribeToAuthChanges(handler: (user: User | null) => void) {
  const client = getFirebaseAuthClient();
  if (!client) return () => undefined;
  return onAuthStateChanged(client, handler);
}
