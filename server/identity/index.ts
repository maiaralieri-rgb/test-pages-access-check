import { isFirebaseConfigured } from "../firebase/admin";
import { FirebaseIdentityProvider } from "./firebase-identity";
import { LocalIdentityProvider } from "./local-identity";
import type { IdentityProvider } from "./types";

let provider: IdentityProvider | null = null;

/**
 * Firebase Auth whenever the project is configured; otherwise the original
 * local accounts, so the app still runs with nothing provisioned.
 */
export function getIdentityProvider(): IdentityProvider {
  if (!provider) {
    provider = isFirebaseConfigured() ? new FirebaseIdentityProvider() : new LocalIdentityProvider();
  }
  return provider;
}

export function resetIdentityProvider() {
  provider = null;
}

export * from "./types";
