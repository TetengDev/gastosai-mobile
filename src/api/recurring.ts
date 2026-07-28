import { api } from "./client";
import type { RecurringExpenseRequest, RecurringExpenseResponse, UpcomingBill } from "./types";

/**
 * Recurring bills and subscriptions.
 *
 * The due dates in `upcomingBills` are computed by the backend from each bill's frequency and
 * day — this client must not work them out from `dayOfMonth`, which would quietly disagree with
 * every other surface the moment month-end or a leap year is involved.
 */
export const listRecurring = () =>
  api.get<RecurringExpenseResponse[]>("/recurring").then((r) => r.data);

/** `month` is `YYYY-MM` and required; the API rejects anything else with a 400. */
export const upcomingBills = (month: string) =>
  api.get<UpcomingBill[]>("/recurring/upcoming", { params: { month } }).then((r) => r.data);

export const createRecurring = (body: RecurringExpenseRequest) =>
  api.post<RecurringExpenseResponse>("/recurring", body).then((r) => r.data);

export const updateRecurring = (id: number, body: RecurringExpenseRequest) =>
  api.put<RecurringExpenseResponse>(`/recurring/${id}`, body).then((r) => r.data);

export const deleteRecurring = (id: number) =>
  api.delete(`/recurring/${id}`).then(() => undefined);
