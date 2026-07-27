import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { AuthProvider } from "../src/context/AuthContext";
import { colors } from "../src/components/ui";

export default function RootLayout() {
  // Server state is cached by TanStack Query, matching the web app's hook pattern. Retries are
  // capped low: on a phone a failing request is usually a dead network, and hammering it drains
  // battery without helping.
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
