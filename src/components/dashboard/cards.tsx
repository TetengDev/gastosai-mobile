import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { budgetSummary } from "../../api/budgets";
import { listGoals } from "../../api/goals";
import { upcomingBills } from "../../api/recurring";
import { categoryReport, topExpenses } from "../../api/reports";
import { expenseAmounts, formatCurrency, formatDateOnly } from "../../lib/formatters";
import { ProgressBar } from "../ui";
import SummaryCard from "./SummaryCard";
import type { SummaryRow } from "./SummaryCard";
import { accents } from "../../theme";

/**
 * The list-shaped dashboard cards, mirroring web's `UpcomingBillsCard`, `BudgetOverviewCard`,
 * `TopExpensesCard` and the category breakdown.
 *
 * Each shows a *short* version and links to the tab holding the full one — a dashboard summarises,
 * it does not duplicate. Each is independently queried, so one failing leaves the rest intact.
 */

/** What is due for the rest of the month. */
export function UpcomingBillsCard({ month }: { month: string }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["recurring", "upcoming", month],
    queryFn: () => upcomingBills(month),
  });

  const rows: SummaryRow[] = (data ?? []).slice(0, 3).map((b, i) => ({
    key: `${b.id}-${b.dueDate}-${i}`,
    label: b.name ?? "-",
    sub: b.dueDate ? formatDateOnly(b.dueDate) : b.categoryName,
    value: formatCurrency(b.amount ?? 0),
  }));

  return (
    <SummaryCard
      testID="card-upcoming"
      title="DUE THIS MONTH"
      rows={rows}
      footer="All recurring"
      onFooterPress={() => router.push("/(app)/more/recurring")}
    />
  );
}

/**
 * The budgets closest to their limit.
 *
 * Sorted by `percentUsed`, which the backend computed — the sort is presentation over values it
 * supplied, not a recalculation. Three rows, because the point is "what is about to bite", and the
 * Budgets tab is one tap away for the rest.
 */
export function BudgetOverviewCard({ month }: { month: string }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });

  const tone = (status?: string) =>
    status === "OVER" || status === "EXCEEDED"
      ? accents.danger
      : status === "NEAR" || status === "WARNING"
        ? accents.amber
        : accents.brand;

  const rows: SummaryRow[] = [...(data?.items ?? [])]
    .sort((a, b) => (b.percentUsed ?? 0) - (a.percentUsed ?? 0))
    .slice(0, 3)
    .map((b) => ({
      key: String(b.categoryId ?? b.categoryName),
      label: b.categoryName ?? "-",
      sub: `${formatCurrency(b.spent ?? 0)} of ${formatCurrency(b.budgeted ?? 0)}`,
      value: `${Math.round(b.percentUsed ?? 0)}%`,
      extra: <ProgressBar percent={b.percentUsed ?? 0} color={tone(b.status)} />,
    }));

  return (
    <SummaryCard
      testID="card-budgets"
      title="CLOSEST TO LIMIT"
      rows={rows}
      footer="All budgets"
      onFooterPress={() => router.push("/(app)/budgets")}
    />
  );
}

/** The month's five largest expenses, ranked by the backend. */
export function TopExpensesCard({ month }: { month: string }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["report", "top", month],
    queryFn: () => topExpenses(month, 5),
  });

  const rows: SummaryRow[] = (data ?? []).map((e) => {
    const { base, original } = expenseAmounts(e);
    return {
      key: String(e.id),
      label: e.description ?? "-",
      sub: [e.category, original].filter(Boolean).join(" · ") || null,
      // `expenseAmounts`, not raw `amount`: a ¥1,500 expense is not ₱1,500.
      value: formatCurrency(base),
    };
  });

  return (
    <SummaryCard
      testID="card-top"
      title="BIGGEST THIS MONTH"
      rows={rows}
      footer="All expenses"
      onFooterPress={() => router.push("/(app)/expenses")}
    />
  );
}

/** Progress on each savings goal, as the server computes it. */
export function GoalProgressCard() {
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["goals"], queryFn: listGoals });

  const rows: SummaryRow[] = (data ?? []).slice(0, 3).map((g) => ({
    key: String(g.id),
    label: g.name ?? "-",
    sub: `${formatCurrency(g.savedAmount ?? 0)} of ${formatCurrency(g.targetAmount ?? 0)}`,
    value: `${Math.round(g.progressPercent ?? 0)}%`,
    extra: <ProgressBar percent={g.progressPercent ?? 0} />,
  }));

  return (
    <SummaryCard
      testID="card-goals"
      title="GOALS"
      rows={rows}
      footer="All goals"
      onFooterPress={() => router.push("/(app)/goals")}
    />
  );
}

/**
 * Spend per category.
 *
 * **Labelled "all time" because it is.** `/expenses/report/category` takes no month parameter, so
 * this card cannot follow the month stepper like everything else on the screen. Saying so is the
 * honest option; letting lifetime totals sit silently under a "June 2026" heading is not.
 */
export function CategoryBreakdownCard() {
  const { data } = useQuery({ queryKey: ["report", "category"], queryFn: categoryReport });

  const rows: SummaryRow[] = (data ?? []).slice(0, 5).map((c) => ({
    key: c.category ?? "-",
    label: c.category ?? "Uncategorized",
    sub: null,
    value: formatCurrency(c.total ?? 0),
  }));

  return <SummaryCard testID="card-categories" title="BY CATEGORY · ALL TIME" rows={rows} />;
}
