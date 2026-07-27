import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { listGoals } from "../../src/api/goals";
import { formatCurrency, formatDateOnly } from "../../src/lib/formatters";
import { Body, Button, Card, ErrorText, Pill, ProgressBar } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

export default function Goals() {
  const t = useTheme();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["goals"],
    queryFn: listGoals,
  });

  const goals = data ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.colors.text2} />
      }
    >
      <Stack.Screen options={{ title: "Goals" }} />

      {isLoading && <ActivityIndicator color={t.colors.text2} />}

      {isError && (
        <View style={{ gap: 12 }}>
          <ErrorText>{errorMessage(error, "Could not load your goals.")}</ErrorText>
          <Button title="Try again" onPress={() => refetch()} />
        </View>
      )}

      {!isLoading && !isError && goals.length === 0 && (
        <Body dim>No savings goals yet. Add them in the web app.</Body>
      )}

      {goals.map((g) => (
        <Card key={g.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
              {g.name}
            </Text>
            {g.paused ? <Pill label="Paused" /> : null}
          </View>
          {/* progressPercent is server-computed; the client renders it as given. */}
          <ProgressBar percent={g.progressPercent ?? 0} />
          <Body dim style={{ fontSize: 12.5 }}>
            {formatCurrency(g.savedAmount ?? 0)} of {formatCurrency(g.targetAmount ?? 0)} ·{" "}
            {Math.round(g.progressPercent ?? 0)}%
          </Body>
          {g.targetDate ? (
            <Body dim style={{ fontSize: 12 }}>by {formatDateOnly(g.targetDate)}</Body>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}
