import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { API_BASE_URL } from "../../src/api/client";
import { Body, Button, Card, Screen, StatTile } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

export default function Settings() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const t = useTheme();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Settings" }} />
      <Card>
        <StatTile label="Signed in as" value={user?.email ?? "-"} sub={user?.name ?? undefined} />
      </Card>
      <Card>
        <Body dim style={{ fontSize: 12.5 }}>API</Body>
        <Body>{API_BASE_URL}</Body>
        <View style={{ height: 8 }} />
        <Body dim style={{ fontSize: 12.5 }}>App version</Body>
        <Body>
          {Constants.expoConfig?.version ?? "-"} · {t.scheme} theme
        </Body>
      </Card>
      <Button
        variant="secondary"
        title="Sign out"
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      />
    </Screen>
  );
}
