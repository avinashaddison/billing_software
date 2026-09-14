import { QueryClient } from "@tanstack/react-query";

/**
 * The app-wide React Query client. It lives in its own module (rather than
 * inside App.tsx) so the auth store can wipe it: every cached response is
 * shaped for the account that fetched it (owner views carry cost prices and
 * customer phones that staff views omit), so the cache must not outlive the
 * sign-in that filled it — a shared counter tablet switching owner → staff
 * would otherwise be served the owner's copy until the background refetch
 * landed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});
