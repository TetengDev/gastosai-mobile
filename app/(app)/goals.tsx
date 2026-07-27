import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { listGoals } from "../../src/api/goals";
import { formatCurrency, formatDateOnly } from "../../src/lib/formatters";
import { Badge, Button, Card, ErrorText, ProgressBar, colors } from "../../src/components/ui";

export default function Goals() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["goals"],
    queryFn: listGoals,
  });

  const goals = data ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
      }
    >
      <Stack.Screen options={{ title: "Goals" }} />

      {isLoading && <ActivityIndicator color={colors.accent} />}

      {isError && (
        <View style={{ gap: 12 }}>
          <ErrorText>{errorMessage(error, "Could not load your goals.")}</ErrorText>
          <Button title="Try again" onPress={() => refetch()} />
        </View>
      )}

      {!isLoading && !isError && goals.length === 0 && (
        <Text style={{ color: colors.muted }}>No savings goals yet. Add them in the web app.</Text>
      )}

      {goals.map((g) => (
        <Card key={g.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{g.name}</Text>
            {g.paused ? <Badge label="PAUSED" tone="neutral" /> : null}
          </View>
          {/* progressPercent is server-computed; the client renders it as given. */}
          <ProgressBar percent={g.progressPercent ?? 0} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {formatCurrency(g.savedAmount ?? 0)} of {formatCurrency(g.targetAmount ?? 0)} ·{" "}
            {Math.round(g.progressPercent ?? 0)}%
          </Text>
          {g.targetDate ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>by {formatDateOnly(g.targetDate)}</Text>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}
