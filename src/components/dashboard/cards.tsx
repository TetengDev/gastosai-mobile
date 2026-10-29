import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { categoryReport, topExpenses } from "../../api/reports";
import { formatCentavos } from "../../lib/formatters";
import { expenseAmountText } from "../money";
import SummaryCard from "./SummaryCard";
import type { SummaryRow } from "./SummaryCard";

/**
 * The two list-shaped cards inside Home's Insights group: the biggest expenses and the category
 * split. Budgets, bills and goals moved into Home's own sections (TEN-444).
 *
 * Each shows a *short* version and links to the tab holding the full one — a dashboard summarises,
 * it does not duplicate. Each is independently queried, so one failing leaves the rest intact.
 */

/** The month's five largest expenses, ranked by the backend. */
export function TopExpensesCard({ month }: { month: string }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["report", "top", month],
    queryFn: () => topExpenses(month, 5),
  });

  const rows: SummaryRow[] = (data ?? []).map((e) => {
    const { base, original } = expenseAmountText(e);
    return {
      key: String(e.id),
      label: e.description ?? "-",
      sub: [e.category, original].filter(Boolean).join(" · ") || null,
      // `expenseAmountText`, not raw `amount`: a ¥1,500 expense is not ₱1,500.
      value: base,
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
    value: formatCentavos(c.total ?? 0),
  }));

  return <SummaryCard testID="card-categories" title="BY CATEGORY · ALL TIME" rows={rows} />;
}
