import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";

export default function AppLayout() {
  const { user, ready } = useAuth();
  // Guard the whole authenticated group in one place rather than per screen.
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  return <Stack />;
}
