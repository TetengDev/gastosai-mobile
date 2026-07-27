import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { currentMonth, formatCurrency, formatMonth } from "../../src/lib/formatters";
import { Button, Card, ErrorText, ProgressBar, colors } from "../../src/components/ui";

/** The backend sets a status per category; map it to a colour rather than re-deriving one. */
function toneFor(status?: string): "good" | "warn" | "bad" {
  if (status === "OVER" || status === "EXCEEDED") return "bad";
  if (status === "NEAR" || status === "WARNING") return "warn";
  return "good";
}

export default function Budgets() {
  const month = currentMonth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });

  const items = data?.items ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
      }
    >
      <Stack.Screen options={{ title: "Budgets" }} />

      {isLoading && <ActivityIndicator color={colors.accent} />}

      {isError && (
        <View style={{ gap: 12 }}>
          <ErrorText>{errorMessage(error, "Could not load your budgets.")}</ErrorText>
          <Button title="Try again" onPress={() => refetch()} />
        </View>
      )}

      {data && (
        <>
          <Card>
            <Text style={{ color: colors.muted }}>{formatMonth(data.month ?? month)}</Text>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700" }}>
              {formatCurrency(data.safeToSpend ?? 0)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>safe to spend</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
              {formatCurrency(data.dailyAllowance ?? 0)} per day · {formatCurrency(data.totalSpent ?? 0)} of{" "}
              {formatCurrency(data.totalBudgeted ?? 0)} used
            </Text>
          </Card>

          {items.length === 0 ? (
            <Text style={{ color: colors.muted }}>
              No budgets set for this month. Add them in the web app.
            </Text>
          ) : (
            items.map((b) => (
              <Card key={b.categoryId ?? b.categoryName}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{b.categoryName}</Text>
                  {/* percentUsed comes from the backend — displayed, never recalculated. */}
                  <Text style={{ color: colors.muted }}>{Math.round(b.percentUsed ?? 0)}%</Text>
                </View>
                <ProgressBar percent={b.percentUsed ?? 0} tone={toneFor(b.status)} />
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {formatCurrency(b.spent ?? 0)} of {formatCurrency(b.budgeted ?? 0)} ·{" "}
                  {formatCurrency(b.remaining ?? 0)} left
                </Text>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
