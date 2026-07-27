import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from "@expo-google-fonts/hanken-grotesk";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { SpaceMono_400Regular } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { AuthProvider } from "../src/context/AuthContext";
import { useTheme } from "../src/theme/useTheme";

// Held until the fonts resolve. Without this the first frame renders in the system font and
// visibly reflows — the type is most of the brand, so a flash of the wrong one is worth avoiding.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable in this environment. Not worth failing startup over.
});

export default function RootLayout() {
  const theme = useTheme();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    SpaceMono_400Regular,
  });

  useEffect(() => {
    // Hide on error too: shipping in the fallback font is far better than hanging on a splash
    // screen the user cannot dismiss.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Server state is cached by TanStack Query, matching the web app's hook pattern. Retries are
  // capped low: on a phone a failing request is usually a dead network, and hammering it drains
  // battery without helping.
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
    [],
  );

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Follows the palette rather than being hardcoded — a light status bar on the light
            theme is invisible. */}
        <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.page },
            headerTintColor: theme.colors.textHi,
            headerTitleStyle: { fontFamily: theme.fonts.display, fontSize: 17 },
            contentStyle: { backgroundColor: theme.colors.page },
          }}
        >
          {/* The (app) group renders its own Stack. Without this the two nest and you get two
              header bars, the outer one titled with the literal group name "(app)". */}
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
