import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { listAlerts, unreadCount } from "../../../src/api/alerts";
import { useAuth } from "../../../src/context/AuthContext";
import { Body, Card, Divider, ListRow } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

/**
 * The hub for everything that is not a daily destination.
 *
 * A tab bar holds three to five things well and nothing beyond that, so the fifth slot buys a
 * door rather than a screen: recurring bills, categories, alerts and chat all live behind it and
 * none of them competes with the four screens people open every day.
 *
 * Deliberately a flat list of rows, in one screenful, with no nesting. If this ever needs a
 * scroll to reach the last row it has stopped being a hub and the grouping needs rethinking —
 * `more.yaml` asserts exactly that.
 */
export default function More() {
  const router = useRouter();
  const t = useTheme();
  const { user, signOut } = useAuth();

  // Shared with the tab badge via the same query key, so the count is fetched once.
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const unread = unreadCount(alerts.data);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You will need to sign in again to record expenses.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
    >
      <Card>
        <ListRow
          testID="more-recurring"
          icon="repeat-outline"
          label="Recurring"
          sub="Bills and subscriptions"
          onPress={() => router.push("/(app)/more/recurring")}
        />
        <Divider />
        <ListRow
          testID="more-categories"
          icon="pricetags-outline"
          label="Categories"
          sub="Rename or remove"
          onPress={() => router.push("/(app)/more/categories")}
        />
        <Divider />
        <ListRow
          testID="more-alerts"
          icon="notifications-outline"
          label="Alerts"
          sub="Budget and bill warnings"
          badge={unread}
          onPress={() => router.push("/(app)/more/alerts")}
        />
        <Divider />
        <ListRow
          testID="more-chat"
          icon="sparkles-outline"
          label="Ask AI"
          sub="Questions about your spending"
          onPress={() => router.push("/(app)/more/chat")}
        />
      </Card>

      <Card>
        <ListRow
          testID="more-settings"
          icon="settings-outline"
          label="Settings"
          sub={user?.email ?? undefined}
          onPress={() => router.push("/(app)/settings")}
        />
        <Divider />
        {/* Confirmed, because signing out on a phone is a fat-finger away from the row above it
            and costs a full re-authentication to undo. */}
        <ListRow
          testID="more-signout"
          icon="log-out-outline"
          label="Sign out"
          destructive
          onPress={confirmSignOut}
        />
      </Card>

      <Body dim style={{ fontSize: 12.5 }}>
        Pricing, billing and admin tools live on the web app.
      </Body>
      <View />
    </ScrollView>
  );
}
