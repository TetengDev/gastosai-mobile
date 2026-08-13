import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { listAlerts, unreadCount } from "../../../src/api/alerts";
import { errorMessage } from "../../../src/api/client";
import { describeSubscription, getSubscription } from "../../../src/api/subscription";
import { useAuth } from "../../../src/context/AuthContext";
import { Body, Card, Divider, ListRow, Pill, Skeleton } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

/**
 * What the user is paying for, at the top of the settings hub.
 *
 * Every word of it comes from `GET /subscription` by way of `describeSubscription` — this
 * component picks a colour and lays the strings out, and decides nothing about plans. Colour is
 * the only judgement it makes, and it is driven by the tone the summary already carries.
 */
function PlanCard() {
  const t = useTheme();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
  });

  // Reserve the same height while loading, so the rows below do not jump under a thumb already
  // travelling towards them.
  if (isLoading) return <Skeleton height={96} />;

  if (isError) {
    return (
      <Card testID="more-plan">
        <Body dim style={{ fontSize: 12.5 }}>Plan</Body>
        <Body>{errorMessage(error)}</Body>
      </Card>
    );
  }

  const { plan, status, detail, tone } = describeSubscription(data);
  const toneColor =
    tone === "danger" ? t.colors.danger : tone === "warn" ? t.colors.warnText : t.colors.text2;

  return (
    <Card testID="more-plan">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          style={{
            fontFamily: t.fonts.mono,
            fontSize: 11,
            letterSpacing: 1.3,
            textTransform: "uppercase",
            color: t.colors.text3,
          }}
        >
          Plan
        </Text>
        <Text style={{ fontFamily: t.fonts.display, fontSize: 20, color: t.colors.textHi }}>
          {plan}
        </Text>
        <View style={{ flex: 1 }} />
        <Pill label={status} dotColor={toneColor} />
      </View>
      {detail ? <Body style={{ fontSize: 13, color: toneColor }}>{detail}</Body> : null}
    </Card>
  );
}

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
      {/* First, because "what am I paying for" is the question this hub is opened with, and a
          card below the rows is a card below the fold on a small phone. */}
      <PlanCard />

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
