import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/components/ui";

export default function AppLayout() {
  const { user, ready } = useAuth();
  // Guard the whole authenticated group in one place rather than per screen.
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  // This Stack owns the headers for the group; the root Stack hides its own for (app), so
  // these options have to be repeated here rather than inherited.
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
