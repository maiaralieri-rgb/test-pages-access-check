import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Admin SDK bootstrap.
 *
 * Credentials come from the environment, never from a file in the repository:
 *  - inside Cloud Functions / Cloud Run the default credentials are injected;
 *  - locally, FIRESTORE_EMULATOR_HOST plus FIREBASE_AUTH_EMULATOR_HOST point the
 *    SDK at the emulators and no real key is needed;
 *  - elsewhere, FIREBASE_SERVICE_ACCOUNT holds the service-account JSON.
 */
let app: App | null = null;

export function isFirebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_SERVICE_ACCOUNT,
  );
}

export function usingEmulators() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export function getFirebaseApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (raw) {
    const parsed = JSON.parse(raw);
    app = initializeApp({ credential: cert(parsed), projectId: parsed.project_id ?? projectId });
  } else {
    // Emulators and managed runtimes both work without an explicit credential.
    app = initializeApp({ projectId });
  }
  return app;
}

export function getFirestoreDb() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}
