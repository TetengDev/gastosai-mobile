import { api } from "./client";
import type { BudgetRequest, BudgetResponse, BudgetSummaryResponse } from "./types";

/**
 * Budget summary for a month.
 *
 * Everything here — `totalSpent`, `safeToSpend`, `dailyAllowance`, and each item's
 * `percentUsed` and `remaining` — is computed by the backend. The client renders those
 * numbers and never recalculates them (CLAUDE.md: no business logic on-device).
 */
export const budgetSummary = (month: string) =>
  api.get<BudgetSummaryResponse>("/budgets/summary", { params: { month } }).then((r) => r.data);

/** Budget definitions for a month, as opposed to the computed summary above. */
export const listBudgets = (month: string) =>
  api.get<BudgetResponse[]>("/budgets", { params: { month } }).then((r) => r.data);

export const createBudget = (body: BudgetRequest) =>
  api.post<BudgetResponse>("/budgets", body).then((r) => r.data);

export const updateBudget = (id: number, body: BudgetRequest) =>
  api.put<BudgetResponse>(`/budgets/${id}`, body).then((r) => r.data);

export const deleteBudget = (id: number) => api.delete(`/budgets/${id}`).then(() => undefined);
