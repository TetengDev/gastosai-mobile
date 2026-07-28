import { api } from "./client";
import type { AlertResponse } from "./types";

/**
 * Budget and bill alerts the backend raises. `severity`, `type` and the message text are all
 * decided server-side — this client renders them and reports what the user did with them.
 *
 * Read and dismiss are separate on purpose, and they are not the same action: reading an alert
 * acknowledges it, dismissing removes it from the list. The unread count that badges the More tab
 * counts the former.
 */
export const listAlerts = () => api.get<AlertResponse[]>("/alerts").then((r) => r.data);

export const markAlertRead = (id: number) =>
  api.patch<AlertResponse>(`/alerts/${id}/read`).then((r) => r.data);

export const dismissAlert = (id: number) =>
  api.patch<AlertResponse>(`/alerts/${id}/dismiss`).then((r) => r.data);

/**
 * Counting undismissed-and-unread rows on a list already fetched is presentation, not business
 * logic — no total or bucket is being derived here. Anything that changes a *number the user
 * acts on* still belongs to the backend (CLAUDE.md §1.2).
 */
export const unreadCount = (alerts: AlertResponse[] | undefined) =>
  (alerts ?? []).filter((a) => !a.read && !a.dismissed).length;
