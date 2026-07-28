import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import {
  expenseAmounts,
  formatCurrency,
  formatDayMonth,
  formatMonth,
  monthRange,
} from "../../src/lib/formatters";
import { useMonth } from "../../src/context/MonthContext";
import { Body, Button, Card, ErrorText, MonthStepper, Skeleton, StatTile } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

export default function Dashboard() {
  const router = useRouter();
  const t = useTheme();
  const { month, shiftMonth, setMonth, isCurrentMonth } = useMonth();
  const range = monthRange(month);

  const report = useQuery({ queryKey: ["report", "monthly"], queryFn: monthlyReport });
  const expenses = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => listExpenses(range),
  });
  const budgets = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });

  // The report is keyed by "YYYY-MM"; find this month's row rather than assuming ordering.
  const thisMonth = report.data?.find((r) => r.month === month);

  /**
   * The most recent month that actually has spending.
   *
   * A month with no expenses used to render ₱0.00 and nothing else, which is indistinguishable
   * from an empty account — and with the app opening on the current month, that is what you saw
   * even with six months of history behind it. Offering the nearest month with data turns a dead
   * end into one tap. Read off the report already fetched; nothing new is computed.
   */
  const latestMonthWithData = (report.data ?? [])
    .filter((r) => (r.total ?? 0) > 0 && r.month)
    .map((r) => r.month as string)
    .sort()
    .pop();

  const monthIsEmpty =
    !report.isLoading && !report.isError && (thisMonth?.total ?? 0) === 0 && !expenses.isLoading;
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
      {/* The control that makes every other month reachable. Above the figures, because it
          changes what all of them mean. */}
      <MonthStepper
        label={formatMonth(month)}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        canGoNext={!isCurrentMonth}
      />

      <Card>
        {report.isLoading ? (
          <Skeleton height={72} />
        ) : (
          <StatTile
            label={formatMonth(month)}
            value={formatCurrency(thisMonth?.total ?? 0)}
            sub={isCurrentMonth ? "spent this month" : "spent"}
          />
        )}
        <ErrorText>{report.isError ? errorMessage(report.error) : null}</ErrorText>

        {monthIsEmpty && latestMonthWithData && latestMonthWithData !== month ? (
          <>
            <Body dim style={{ fontSize: 12.5 }}>
              Nothing recorded in {formatMonth(month)}.
            </Body>
            <Button
              testID="jump-to-latest"
              size="sm"
              variant="secondary"
              title={`Show ${formatMonth(latestMonthWithData)}`}
              onPress={() => setMonth(latestMonthWithData)}
            />
          </>
        ) : null}
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
              {formatCurrency(expenseAmounts(e).base)}
            </Text>
          </Pressable>
        ))}
        {!expenses.isLoading && !expenses.isError && recent.length === 0 && (
          // Month-aware: "No expenses yet" on a month that merely happens to be empty reads as
          // "your account is empty", which is exactly the false impression this release removes.
          <Body dim>
            {latestMonthWithData
              ? `Nothing in ${formatMonth(month)}.`
              : "No expenses yet — tap + to add your first one."}
          </Body>
        )}
      </Card>
    </ScrollView>
  );
}
