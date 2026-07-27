import { Stack, useRouter } from "expo-router";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "../../src/context/AuthContext";
import { API_BASE_URL } from "../../src/api/client";
import { Button, Card, colors } from "../../src/components/ui";

export default function Settings() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 }}>
      <Stack.Screen options={{ title: "Settings" }} />
      <Card>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Signed in as</Text>
        <Text style={{ color: colors.text, fontSize: 16 }}>{user?.email ?? "-"}</Text>
        {user?.name ? <Text style={{ color: colors.muted }}>{user.name}</Text> : null}
      </Card>
      <Card>
        <Text style={{ color: colors.muted, fontSize: 13 }}>API</Text>
        <Text style={{ color: colors.text }}>{API_BASE_URL}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>App version</Text>
        <Text style={{ color: colors.text }}>{Constants.expoConfig?.version ?? "-"}</Text>
      </Card>
      <Button
        variant="ghost"
        title="Sign out"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
    </View>
  );
}
