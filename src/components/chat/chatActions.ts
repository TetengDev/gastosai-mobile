/**
 * Labels and confirmation phrasing for assistant-proposed actions.
 *
 * **Ported from `gastosai-web/src/components/chat/chatActions.ts` and must stay in step with it.**
 * That is not a preference: confirming a proposed write means re-sending a *rephrased English
 * sentence* with `mode: "execute"`, and the backend parses it. If the two clients word it
 * differently, one of them silently fails to confirm.
 *
 * The right fix is a structured confirm on the API — send back the tool name and params the server
 * already proposed, rather than a sentence for it to re-parse. That is a backend change, recorded
 * in KNOWN-GAPS.md.
 */

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
 * The sentence sent back to confirm a proposed action.
 *
 * Character-for-character the same as web's. An empty string means "this tool has no confirmation
 * phrasing" — the caller must not send an empty message, and shows an error instead of guessing.
 */
export function buildConfirmMessage(toolName: string, params: Record<string, unknown>): string {
  switch (toolName) {
    case "create_budget":
      return `create a budget for ${params.categoryName} ₱${params.amountLimit} month ${params.month}`;
    case "create_goal":
      return `create a goal called ${params.name} target ₱${params.targetAmount}${params.savedAmount ? ` saved ₱${params.savedAmount}` : ""}`;
    case "create_recurring":
      return `create recurring ${params.name} ₱${params.amount} ${params.frequency}${params.categoryName ? ` ${params.categoryName}` : ""}`;
    case "create_expense":
      return `₱${params.amount} ${params.description}${params.category ? ` ${params.category}` : ""}`;
    case "create_category":
      return `create category ${params.name}${params.icon ? ` icon ${params.icon}` : ""}`;
    case "rename_category":
      return `rename category ${params.currentName} to ${params.newName}`;
    case "delete_category":
      return `delete category ${params.name}`;
    case "update_goal":
      return `update goal${params.id ? ` id ${params.id}` : params.name ? ` ${params.name}` : ""}${params.targetAmount !== undefined ? ` target ₱${params.targetAmount}` : ""}${params.savedAmount !== undefined ? ` saved ₱${params.savedAmount}` : ""}${params.paused !== undefined ? ` paused ${params.paused}` : ""}`;
    case "update_recurring":
      return `update recurring${params.id ? ` id ${params.id}` : params.name ? ` ${params.name}` : ""}${params.amount !== undefined ? ` ₱${params.amount}` : ""}${params.frequency !== undefined ? ` ${params.frequency}` : ""}${params.active !== undefined ? ` active ${params.active}` : ""}`;
    case "update_profile":
      return `update profile${params.name ? ` name ${params.name}` : ""}${params.nickname ? ` nickname ${params.nickname}` : ""}${params.avatar ? ` avatar ${params.avatar}` : ""}`;
    case "delete_expenses":
      return `delete expenses${params.category ? ` category ${params.category}` : ""}${params.from ? ` from ${params.from}` : ""}${params.to ? ` to ${params.to}` : ""}`;
    case "recategorize_expenses":
      return `recategorize expenses from ${params.fromCategory} to ${params.toCategory}`;
    default:
      return "";
  }
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
