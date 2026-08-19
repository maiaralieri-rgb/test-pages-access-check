import { useCallback, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { getFirebaseAuthClient, isFirebaseEnabled } from "@/lib/firebase-client";
import { trpc } from "@/lib/trpc";

/**
 * One hook, two identity backends.
 *
 * With Firebase the browser signs in against Firebase Auth and every API call
 * carries the resulting ID token. Without it, the original cookie session is
 * used. `localAuth.me` is the single source of truth for the profile in both
 * cases, so the screens do not need to know which mode is active.
 */
export function useLocalAuth() {
  const utils = trpc.useUtils();
  const session = trpc.localAuth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const registerMutation = trpc.localAuth.register.useMutation();
  const loginMutation = trpc.localAuth.login.useMutation();
  const logoutMutation = trpc.localAuth.logout.useMutation();

  const [pending, setPending] = useState(false);
  const firebase = isFirebaseEnabled();

  const refresh = useCallback(async () => {
    await utils.localAuth.me.invalidate();
    return session.refetch();
  }, [utils, session]);

  const login = useCallback(
    async (email: string, password: string) => {
      setPending(true);
      try {
        if (firebase) {
          const auth = getFirebaseAuthClient();
          if (!auth) throw new Error("Firebase não está configurado neste ambiente.");
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          await loginMutation.mutateAsync({ email, password });
        }
        await refresh();
      } finally {
        setPending(false);
      }
    },
    [firebase, loginMutation, refresh],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      registrationId: string;
      password: string;
      registrationCode: string;
      inviteToken?: string;
    }) => {
      setPending(true);
      try {
        // The account is always created server-side, so the registration code
        // and the stage invite are validated before any credential exists.
        const account = await registerMutation.mutateAsync(input);
        if (firebase) {
          const auth = getFirebaseAuthClient();
          if (auth) await signInWithEmailAndPassword(auth, input.email, input.password);
        }
        await refresh();
        return account;
      } finally {
        setPending(false);
      }
    },
    [firebase, registerMutation, refresh],
  );

  const logout = useCallback(async () => {
    setPending(true);
    try {
      if (firebase) {
        const auth = getFirebaseAuthClient();
        if (auth) await signOut(auth);
      } else {
        await logoutMutation.mutateAsync();
      }
      await refresh();
    } finally {
      setPending(false);
    }
  }, [firebase, logoutMutation, refresh]);

  /** Password recovery only exists in the Firebase mode. */
  const resetPassword = useCallback(
    async (email: string) => {
      const auth = getFirebaseAuthClient();
      if (!auth) throw new Error("A recuperação de senha exige o modo Firebase.");
      await sendPasswordResetEmail(auth, email);
    },
    [],
  );

  return {
    account: session.data ?? null,
    loading: session.isLoading,
    isAuthenticated: Boolean(session.data),
    pending,
    supportsPasswordReset: firebase,
    login,
    register,
    logout,
    resetPassword,
    refresh,
  };
}

export { onAuthStateChanged, createUserWithEmailAndPassword };
