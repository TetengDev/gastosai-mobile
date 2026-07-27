import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { colors } from "../src/components/ui";

export default function Index() {
  const { user, ready } = useAuth();

  // Reading the token from SecureStore is async. Redirecting before it resolves would bounce a
  // signed-in user to the login screen on every cold start.
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={user ? "/(app)/dashboard" : "/login"} />;
}
