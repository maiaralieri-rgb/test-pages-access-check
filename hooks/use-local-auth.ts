import { trpc } from "@/lib/trpc";

export function useLocalAuth() {
  const session = trpc.localAuth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const login = trpc.localAuth.login.useMutation({ onSuccess: () => session.refetch() });
  const register = trpc.localAuth.register.useMutation({ onSuccess: () => session.refetch() });
  const logout = trpc.localAuth.logout.useMutation({ onSuccess: () => session.refetch() });

  return {
    account: session.data ?? null,
    loading: session.isLoading,
    isAuthenticated: Boolean(session.data),
    login,
    register,
    logout,
    refresh: session.refetch,
  };
}
