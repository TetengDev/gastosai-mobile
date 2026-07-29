import { api } from "./client";
import type { CategoryReportItem, ExpenseResponse, MonthlyComparison } from "./types";

/**
 * The aggregate reports behind the dashboard cards.
 *
 * Every figure here is computed by the backend — `changePercent`, category totals, the ranking of
 * top expenses. The client picks which to show and how to draw it, and nothing else (CLAUDE.md
 * §1.2).
 */

/** The month's largest expenses, already ranked server-side. */
export const topExpenses = (month: string, limit = 5) =>
  api
    .get<ExpenseResponse[]>("/expenses/report/top", { params: { month, limit } })
    .then((r) => r.data);

/** This month against the previous one, including the percentage change. */
export const monthlyComparison = (month: string) =>
  api
    .get<MonthlyComparison>("/expenses/report/monthly-comparison", { params: { month } })
    .then((r) => r.data);

/**
 * Spend per category.
 *
 * **All-time, not month-scoped** — this endpoint takes no `month` parameter, unlike every other
 * report. The card that renders it has to say so; showing lifetime totals under a heading that
 * reads "June 2026" would be quietly wrong.
 */
export const categoryReport = () =>
  api.get<CategoryReportItem[]>("/expenses/report/category").then((r) => r.data);
