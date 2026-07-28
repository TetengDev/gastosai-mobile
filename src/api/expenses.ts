import { api } from "./client";
import type {
  CategoryResponse,
  ExpenseRequest,
  ExpenseResponse,
  DailyReportItem,
  MonthlyReportItem,
  ParseExpenseRequest,
  ParsedExpenseResult,
} from "./types";

/**
 * Expense and category calls. Every shape here comes from the generated contract — see
 * `src/api/types.ts`.
 *
 * `GET /expenses` returns a plain array; `GET /expenses/page` is the paged variant. That
 * distinction is documented in the contract and easy to get wrong from memory.
 */

/**
 * `from`/`to` are inclusive `YYYY-MM-DD` bounds the API already accepted — this client simply
 * never sent them, and so always pulled every expense ever recorded. Scoping to the selected month
 * is what turns a 77-row wall into the ~10-27 rows of one month.
 *
 * Omitting both still returns everything, which is what the AI capture flow wants for ordering
 * category chips by frequency.
 */
export const listExpenses = (range?: { from: string; to: string }) =>
  api
    .get<ExpenseResponse[]>("/expenses", range ? { params: range } : undefined)
    .then((r) => r.data);

/**
 * Per-day totals for a month, server-computed.
 *
 * The expense list groups by day and shows a total per day. Summing the rows on the phone would be
 * easy and wrong — a day total is a number the user acts on, and CLAUDE.md §1.2 keeps those on the
 * backend. This endpoint exists precisely so the section headers can be honest.
 */
export const dailyReport = (month: string) =>
  api
    .get<DailyReportItem[]>("/expenses/report/daily", { params: { month } })
    .then((r) => r.data);

export const getExpense = (id: number) =>
  api.get<ExpenseResponse>(`/expenses/${id}`).then((r) => r.data);

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

/**
 * Turns free text into a candidate expense. Consumes AI quota, so callers must handle 429.
 *
 * The result is a *proposal*, never a saved expense — see `saveable`, `confidence`,
 * `rejectionMessage` and `hint`. Saving is a separate, explicit POST.
 */
export const parseExpense = (body: ParseExpenseRequest) =>
  api.post<ParsedExpenseResult>("/expenses/parse", body).then((r) => r.data);
