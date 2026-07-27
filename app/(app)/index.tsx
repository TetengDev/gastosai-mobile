import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import { currentMonth, formatCurrency, formatDayMonth, formatMonth } from "../../src/lib/formatters";
import { Body, Card, ErrorText, Skeleton, StatTile } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

export default function Dashboard() {
  const router = useRouter();
  const t = useTheme();
  const month = currentMonth();
  const report = useQuery({ queryKey: ["report", "monthly"], queryFn: monthlyReport });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });
  const budgets = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });

  // The report is keyed by "YYYY-MM"; find this month's row rather than assuming ordering.
  const thisMonth = report.data?.find((r) => r.month === month);
  // Four, not five: Home is a quick check-in rather than a report. The full list is one tap away
  // on Expenses, so a fifth row here buys nothing and pushes the card further under the floating
  // + button. (`paddingBottom` below keeps the last row scrollable clear of that button.)
  const recent = (expenses.data ?? []).slice(0, 4);
  const refreshing = report.isRefetching || expenses.isRefetching || budgets.isRefetching;

  const refreshAll = () => {
    report.refetch();
    expenses.refetch();
    budgets.refetch();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={t.colors.text2} />
      }
    >
      <Card>
        {report.isLoading ? (
          <Skeleton height={72} />
        ) : (
          <StatTile
            label={formatMonth(month)}
            value={formatCurrency(thisMonth?.total ?? 0)}
            sub="spent this month"
          />
        )}
        <ErrorText>{report.isError ? errorMessage(report.error) : null}</ErrorText>
      </Card>

      {/* Safe-to-spend is the number most worth seeing on a phone. Server-computed — rendered,
          never recalculated. */}
      {budgets.data ? (
        <Card tone="panel">
          <StatTile
            label="Safe to spend"
            value={formatCurrency(budgets.data.safeToSpend ?? 0)}
            sub={`${formatCurrency(budgets.data.dailyAllowance ?? 0)} per day`}
          />
        </Card>
      ) : null}

      <Card>
        <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
          Recent
        </Text>
        {expenses.isLoading && <Skeleton height={120} />}
        <ErrorText>{expenses.isError ? errorMessage(expenses.error) : null}</ErrorText>
        {recent.map((e, i) => (
          <Pressable
            key={e.id}
            // Positional, for UI automation. Targeting a row by its amount is ambiguous — the
            // month-total tile above renders the identical string whenever the row is the only
            // expense of the month — and matching on the description is worse still, since the
            // AI parser rewrites it.
            testID={`recent-row-${i}`}
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/expense/${e.id}`)}
            style={({ pressed }) => [
              { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Body numberOfLines={1}>{e.description ?? "-"}</Body>
              <Body dim style={{ fontSize: 12.5 }}>
                {e.category ?? "Uncategorized"} · {formatDayMonth(e.date)}
              </Body>
            </View>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
              {formatCurrency(e.amount ?? 0)}
            </Text>
          </Pressable>
        ))}
        {!expenses.isLoading && !expenses.isError && recent.length === 0 && (
          <Body dim>No expenses yet — tap + to add your first one.</Body>
        )}
      </Card>
    </ScrollView>
  );
}
