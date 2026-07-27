import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { currentMonth, formatCurrency, formatMonth } from "../../src/lib/formatters";
import { Body, Button, Card, ErrorText, Pill, ProgressBar, StatTile } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";
import { accents } from "../../src/theme";

/** The backend sets a status per category; map it to a colour rather than re-deriving one. */
function toneColor(status?: string): string {
  if (status === "OVER" || status === "EXCEEDED") return accents.danger;
  if (status === "NEAR" || status === "WARNING") return accents.amber;
  return accents.brand;
}

export default function Budgets() {
  const t = useTheme();
  const month = currentMonth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });

  const items = data?.items ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.colors.text2} />
      }
    >
            {isLoading && <ActivityIndicator color={t.colors.text2} />}

      {isError && (
        <View style={{ gap: 12 }}>
          <ErrorText>{errorMessage(error, "Could not load your budgets.")}</ErrorText>
          <Button title="Try again" onPress={() => refetch()} />
        </View>
      )}

      {data && (
        <>
          <Card tone="panel">
            <StatTile
              label={formatMonth(data.month ?? month)}
              value={formatCurrency(data.safeToSpend ?? 0)}
              sub={`safe to spend · ${formatCurrency(data.dailyAllowance ?? 0)} per day`}
            />
            <Body dim style={{ fontSize: 12.5, marginTop: 8 }}>
              {formatCurrency(data.totalSpent ?? 0)} of {formatCurrency(data.totalBudgeted ?? 0)} used
            </Body>
          </Card>

          {items.length === 0 ? (
            <Body dim>No budgets set for this month. Add them in the web app.</Body>
          ) : (
            items.map((b) => (
              <Card key={b.categoryId ?? b.categoryName}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
                    {b.categoryName}
                  </Text>
                  {/* percentUsed comes from the backend — displayed, never recalculated. */}
                  <Pill label={`${Math.round(b.percentUsed ?? 0)}%`} dotColor={toneColor(b.status)} />
                </View>
                <ProgressBar percent={b.percentUsed ?? 0} color={toneColor(b.status)} />
                <Body dim style={{ fontSize: 12.5 }}>
                  {formatCurrency(b.spent ?? 0)} of {formatCurrency(b.budgeted ?? 0)} ·{" "}
                  {formatCurrency(b.remaining ?? 0)} left
                </Body>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
