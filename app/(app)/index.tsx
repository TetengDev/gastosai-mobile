import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import { listGoals } from "../../src/api/goals";
import { upcomingBills } from "../../src/api/recurring";
import { formatMonth, monthRange, nowForApi } from "../../src/lib/formatters";
import { pisoMoodFor, toBand } from "../../src/lib/pisoMood";
import { useMonth } from "../../src/context/MonthContext";
import { Body, Button, ErrorText, MonthStepper } from "../../src/components/ui";
import { GoalsStrip, Hero, Insights, NeedsAttention, RecentList } from "../../src/components/dashboard/Home";
import {
  budgetMeter,
  celebrationsFor,
  closedUnderBudget,
  daysLeftInMonth,
  needsAttention,
  statusLine,
} from "../../src/components/dashboard/homeStatus";
import { useTheme } from "../../src/theme/useTheme";

/**
 * Home, spec §4: one answer first — the hero — then what needs attention, goals and recent, with
 * the report folded into Insights. Every figure is the server's; this screen picks and arranges.
 */
export default function Dashboard() {
  const t = useTheme();
  const { month, shiftMonth, setMonth, isCurrentMonth } = useMonth();
  const range = monthRange(month);
  const today = nowForApi().slice(0, 10);

  const report = useQuery({ queryKey: ["report", "monthly"], queryFn: monthlyReport });
  const expenses = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => listExpenses(range),
  });
  const budgets = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });
  const bills = useQuery({
    queryKey: ["recurring", "upcoming", month],
    queryFn: () => upcomingBills(month),
  });
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });

  // The report is keyed by "YYYY-MM"; find this month's row rather than assuming ordering.
  const thisMonth = report.data?.find((r) => r.month === month);

  // The most recent month with spending, so an empty month offers a way to one that has some.
  const latestMonthWithData = (report.data ?? [])
    .filter((r) => (r.total ?? 0) > 0 && r.month)
    .map((r) => r.month as string)
    .sort()
    .pop();

  const monthIsEmpty =
    !report.isLoading && !report.isError && (thisMonth?.total ?? 0) === 0 && !expenses.isLoading;
  const showJump = monthIsEmpty && !!latestMonthWithData && latestMonthWithData !== month;

  const items = budgets.data?.items ?? [];
  const bands = items.map((b) => toBand(b.status));
  const mood = pisoMoodFor({
    bands,
    hasExpenses: (thisMonth?.total ?? 0) > 0 || (expenses.data?.length ?? 0) > 0,
    cheer: closedUnderBudget(month, today, bands),
  });
  const status =
    report.isLoading || budgets.isLoading || report.isError || showJump
      ? null
      : statusLine({
          mood,
          safeToSpend: budgets.data?.safeToSpend ?? 0,
          hasBudget: (budgets.data?.totalBudgeted ?? 0) > 0,
          daysLeft: daysLeftInMonth(month, today),
        });

  const refreshing =
    report.isRefetching || expenses.isRefetching || budgets.isRefetching || bills.isRefetching || goals.isRefetching;
  const refreshAll = () => {
    report.refetch();
    expenses.refetch();
    budgets.refetch();
    bills.refetch();
    goals.refetch();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={t.colors.text2} />
      }
    >
      {/* Above the figures, because it changes what all of them mean. */}
      <MonthStepper
        label={formatMonth(month)}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        canGoNext={!isCurrentMonth}
      />

      <Hero
        spent={thisMonth?.total ?? 0}
        loading={report.isLoading}
        sub={isCurrentMonth ? "spent this month" : "spent"}
        mood={mood}
        status={status}
        meter={budgetMeter(budgets.data, bands)}
        celebrations={celebrationsFor({ month, today, bands, goals: goals.data ?? [] })}
      >
        {report.isError ? (
          <>
            <ErrorText>{errorMessage(report.error, "Could not reach the server.")}</ErrorText>
            <Button testID="home-retry" size="sm" variant="secondary" title="Try again" onPress={refreshAll} />
          </>
        ) : null}
        {showJump ? (
          <>
            <Body dim style={{ fontSize: 12.5 }}>
              Nothing recorded in {formatMonth(month)}.
            </Body>
            <Button
              testID="jump-to-latest"
              size="sm"
              variant="secondary"
              title={`Show ${formatMonth(latestMonthWithData as string)}`}
              onPress={() => setMonth(latestMonthWithData as string)}
            />
          </>
        ) : null}
      </Hero>

      <NeedsAttention rows={needsAttention(items, bills.data ?? [], today)} />
      <GoalsStrip goals={goals.data ?? []} />
      <RecentList
        expenses={expenses.data ?? []}
        loading={expenses.isLoading}
        error={expenses.isError ? errorMessage(expenses.error) : null}
        emptyText={
          latestMonthWithData ? `Nothing in ${formatMonth(month)}.` : "No expenses yet. Tap + to add your first one."
        }
      />
      <Insights month={month} />
    </ScrollView>
  );
}
