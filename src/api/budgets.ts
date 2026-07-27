import { api } from "./client";
import type { BudgetSummaryResponse } from "./types";

/**
 * Budget summary for a month.
 *
 * Everything here — `totalSpent`, `safeToSpend`, `dailyAllowance`, and each item's
 * `percentUsed` and `remaining` — is computed by the backend. The client renders those
 * numbers and never recalculates them (CLAUDE.md: no business logic on-device).
 */
export const budgetSummary = (month: string) =>
  api.get<BudgetSummaryResponse>("/budgets/summary", { params: { month } }).then((r) => r.data);
