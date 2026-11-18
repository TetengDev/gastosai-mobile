import { useCallback, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { RefreshControl, ScrollView } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import { listGoals } from "../../src/api/goals";
import { listRecurring, markRecurringPaid, upcomingBills } from "../../src/api/recurring";
import { currentMonth, formatMonth, monthRange, nowForApi } from "../../src/lib/formatters";
import { toBand } from "../../src/lib/pisoMood";
import { useMonth } from "../../src/context/MonthContext";
import { Body, Button, ErrorText, MonthStepper } from "../../src/components/ui";
import { GoalsStrip, Hero, Insights, NeedsAttention, RecentList } from "../../src/components/dashboard/Home";
import {
  billMonths,
  budgetMeter,
  celebrationsFor,
  daysLeftInMonth,
  heroMood,
  needsAttention,
  previousMonth,
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
  // Next month's bills too once the seven-day window crosses the month end.
  const bills = useQueries({
    queries: billMonths(month, today).map((m) => ({
      queryKey: ["recurring", "upcoming", m],
      queryFn: () => upcomingBills(m),
    })),
  });
  const upcoming = bills.flatMap((q) => q.data ?? []);
  // Either month's bills failing is said in Needs attention, beside the bills that did load —
  // unless the hero already says the server is unreachable, where the sections stay silent
  // (.maestro/offline.yaml) rather than repeat it. Hidden while the report is still retrying too,
  // so it does not flash up before the hero's own error.
  const billsFailed = report.isError || report.isLoading ? undefined : bills.find((q) => q.isError);
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  // The month that just closed, for its celebration — fetched only on the current month's view.
  const prevMonth = previousMonth(month);
  const closed = useQuery({
    queryKey: ["budgets", "summary", prevMonth],
    queryFn: () => budgetSummary(prevMonth),
    enabled: isCurrentMonth,
  });
  // Each bill's paid state (R2), and what was due last month (R3), for the overdue rows. Either
  // failing is silent: the rows fall back to upcoming bills alone.
  const recurring = useQuery({ queryKey: ["recurring"], queryFn: listRecurring });
  const billsLastMonth = useQuery({
    queryKey: ["recurring", "upcoming", prevMonth],
    queryFn: () => upcomingBills(prevMonth),
    enabled: isCurrentMonth,
  });

  // The ["recurring"] prefix covers the list and every upcoming month, so a marked bill leaves
  // overdue on the refetch. Returned, so the mutation stays pending until that lands.
  const queryClient = useQueryClient();
  const markPaid = useMutation({
    mutationFn: (id: number) => markRecurringPaid(id, currentMonth()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring"] }),
  });
  // A ref, not isPending: two taps inside one frame both read a stale isPending.
  const marking = useRef(false);
  const onMarkPaid = (id: number) => {
    // The bill as it is now, not as the row saw it; one already paid needs no call.
    const bill = recurring.data?.find((r) => r.id === id);
    if (marking.current || !bill || bill.paidThisMonth) return;
    marking.current = true;
    markPaid.mutate(id, {
      onSettled: () => {
        marking.current = false;
      },
    });
  };

  // Tabs stay mounted when hidden: a cheer played behind another tab is spent where nobody sees it.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

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
  // Everything Piso's mood reads; until it has all landed, Piso and the line under it hold still.
  const moodLoading = report.isLoading || budgets.isLoading || expenses.isLoading;
  const mood = heroMood({
    loading: moodLoading,
    bands,
    hasExpenses: (thisMonth?.total ?? 0) > 0 || (expenses.data?.length ?? 0) > 0,
  });
  const hasBudget = (budgets.data?.totalBudgeted ?? 0) > 0;
  const status =
    moodLoading || report.isError || showJump
      ? null
      : statusLine({
          mood,
          safeToSpend: budgets.data?.safeToSpend ?? 0,
          hasBudget,
          daysLeft: daysLeftInMonth(month, today),
        });

  const refreshing =
    report.isRefetching ||
    expenses.isRefetching ||
    budgets.isRefetching ||
    bills.some((q) => q.isRefetching) ||
    recurring.isRefetching ||
    billsLastMonth.isRefetching ||
    goals.isRefetching;
  const refreshAll = () => {
    report.refetch();
    expenses.refetch();
    budgets.refetch();
    bills.forEach((q) => q.refetch());
    recurring.refetch();
    // refetch() ignores `enabled`; last month's bills are only the current month's business.
    if (isCurrentMonth) billsLastMonth.refetch();
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
        noBudget={status !== null && mood !== "empty" && !hasBudget && !budgets.isError}
        // Nothing until both sources land: otherwise a goal starts playing, the closed month
        // arrives, and the queue's "month first" order cuts the goal off mid-cheer.
        celebrations={
          !focused || goals.isLoading || closed.isLoading
            ? []
            : celebrationsFor({
                month,
                today,
                previousBands: (closed.data?.items ?? []).map((b) => toBand(b.status)),
                goals: goals.data ?? [],
              })
        }
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

      <NeedsAttention
        rows={needsAttention(
          items,
          { month, upcoming, upcomingPrevious: billsLastMonth.data, recurring: recurring.data },
          today,
        )}
        error={
          markPaid.isError
            ? "Could not mark that bill paid. Try again."
            : billsFailed
              ? errorMessage(billsFailed.error)
              : null
        }
        onMarkPaid={onMarkPaid}
      />
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
