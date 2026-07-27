import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme } from "../../src/theme/useTheme";

export default function AppLayout() {
  const { user, ready } = useAuth();
  const t = useTheme();
  // Guard the whole authenticated group in one place rather than per screen.
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  // This Stack owns the headers for the group; the root Stack hides its own for (app), so these
  // options have to be repeated here rather than inherited.
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.page },
        headerTintColor: t.colors.textHi,
        headerTitleStyle: { fontFamily: t.fonts.display, fontSize: 17 },
        contentStyle: { backgroundColor: t.colors.page },
      }}
    />
  );
}
