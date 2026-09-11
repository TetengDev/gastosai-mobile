import { api, API_BASE_URL } from "../../api/client";
import type { components } from "../../api/generated/schema";

/**
 * Labels and the confirm call for assistant-proposed actions.
 *
 * Confirming used to mean rebuilding an English sentence from the proposal and sending it back for
 * the backend to re-parse — phrasing this file and web's copy had to keep character-for-character
 * identical, or one client silently failed to confirm. `POST /ai/chat/confirm` now takes the
 * `toolName` and `params` the server itself proposed, so there is no sentence to agree on and
 * nothing to re-parse (TEN-168; web is TEN-167).
 */

type Schemas = components["schemas"];

/** Human name for a tool, for the confirmation card's heading. */
export function actionLabel(toolName: string): string {
  const labels: Record<string, string> = {
    create_budget: "New budget",
    create_goal: "New savings goal",
    create_recurring: "New recurring expense",
    create_expense: "New expense",
    update_budget: "Update budget",
    create_category: "New category",
    rename_category: "Rename category",
    delete_category: "Delete category",
    update_goal: "Update savings goal",
    update_recurring: "Update recurring expense",
    update_profile: "Update profile",
    list_goals: "Your savings goals",
    list_budgets: "Budget summary",
    list_recurring: "Recurring expenses",
    list_alerts: "Your alerts",
    search_expenses: "Expense search results",
    get_category_totals: "Category totals",
    get_monthly_report: "Monthly report",
    mark_alert_read: "Mark alert read",
    dismiss_alert: "Dismiss alert",
    delete_alert: "Delete alert",
    set_default_category: "Set default category",
    set_category_icon: "Set category icon",
    delete_expenses: "Delete expenses",
    recategorize_expenses: "Recategorize expenses",
  };
  return labels[toolName] ?? "Confirm action";
}

/**
 * One assistant turn from `POST /ai/chat/confirm`.
 *
 * The v1 `ChatResponse`, taken from the generated schema as-is — see `confirmChatAction` for why
 * this one call is not on `/api/v2`. The aliases in `src/api/types.ts` all point at the centavos
 * members, so they do not describe this turn and are not reused.
 */
export type ChatConfirmResponse = Schemas["ChatResponse"];

/**
 * Execute the action the server proposed on a `preview` turn, by handing its `toolName` and
 * `params` straight back. No sentence is rebuilt, so nothing is re-parsed and the action that runs
 * is the one the card showed.
 *
 * Three things about this call are not like the rest of `src/api/`:
 *
 * - **It is posted to the unversioned surface**, overriding the client's `/api/v2` base. The
 *   contract publishes `/ai/chat/confirm` only there, on purpose: a preview's `params` are the v1
 *   decimal arguments, and re-reading them as centavos would confirm the amount a hundredfold.
 *   They are echoed unchanged, and no money is parsed here.
 * - **Its `result` carries decimal money.** Every tool reachable through a preview is a write, and
 *   `ResultView` renders a single write result as a plain key/value list — no amount from it
 *   reaches `formatCentavos`, which is the call that would be wrong by a hundred.
 * - **It waits as long as a chat turn does**, for the same reason `sendChat` does: confirming runs
 *   the tool against the database, and the CRUD-sized default aborts a request the server is still
 *   answering.
 */
export async function confirmChatAction(
  toolName: string,
  params: Record<string, unknown>,
  conversationId?: number,
): Promise<ChatConfirmResponse> {
  const body: Schemas["ChatConfirmRequest"] = { toolName, params, mode: "execute", conversationId };
  const res = await api.post<ChatConfirmResponse>("/ai/chat/confirm", body, {
    baseURL: API_BASE_URL,
    timeout: 90_000,
  });
  return res.data;
}

/** Whether a proposed action would change data — used to colour the confirm button. */
export function isDestructive(toolName: string): boolean {
  return toolName.startsWith("delete_") || toolName === "recategorize_expenses";
}

/**
 * The query keys an executed tool invalidates.
 *
 * Web dispatches DOM events for this; the mobile equivalent is telling TanStack Query what went
 * stale. Over-invalidating is cheap and safe — a wrong number on screen is not.
 */
export function affectedQueryKeys(toolName: string): string[][] {
  if (toolName.includes("expense")) return [["expenses"], ["report"], ["budgets"]];
  if (toolName.includes("budget")) return [["budgets"], ["report"]];
  if (toolName.includes("goal")) return [["goals"]];
  if (toolName.includes("recurring")) return [["recurring"]];
  if (toolName.includes("categor")) return [["categories"], ["expenses"], ["report"]];
  if (toolName.includes("alert")) return [["alerts"]];
  return [["expenses"], ["report"], ["budgets"], ["goals"], ["categories"], ["alerts"]];
}
