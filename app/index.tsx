import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/theme/useTheme";

export default function Index() {
  const { user, ready } = useAuth();
  const t = useTheme();

  // Reading the token from SecureStore is async. Redirecting before it resolves would bounce a
  // signed-in user to the login screen on every cold start.
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.page, justifyContent: "center" }}>
        <ActivityIndicator color={t.colors.text2} />
      </View>
    );
  }

  return <Redirect href={user ? "/(app)/dashboard" : "/login"} />;
}
