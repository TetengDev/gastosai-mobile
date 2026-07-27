import { api } from "./client";
import type {
  CategoryResponse,
  ExpenseRequest,
  ExpenseResponse,
  MonthlyReportItem,
} from "./types";

/**
 * Expense and category calls. Every shape here comes from the generated contract — see
 * `src/api/types.ts`.
 *
 * `GET /expenses` returns a plain array; `GET /expenses/page` is the paged variant. That
 * distinction is documented in the contract and easy to get wrong from memory.
 */

export const listExpenses = () =>
  api.get<ExpenseResponse[]>("/expenses").then((r) => r.data);

export const createExpense = (body: ExpenseRequest) =>
  api.post<ExpenseResponse>("/expenses", body).then((r) => r.data);

export const updateExpense = (id: number, body: ExpenseRequest) =>
  api.put<ExpenseResponse>(`/expenses/${id}`, body).then((r) => r.data);

export const deleteExpense = (id: number) =>
  api.delete<void>(`/expenses/${id}`).then((r) => r.data);

export const listCategories = () =>
  api.get<CategoryResponse[]>("/categories").then((r) => r.data);

/** Month totals for the dashboard. `GET /expenses/report/monthly`. */
export const monthlyReport = () =>
  api.get<MonthlyReportItem[]>("/expenses/report/monthly").then((r) => r.data);
