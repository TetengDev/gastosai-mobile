import type { PisoState } from "../../brand/Piso";
import type { BudgetSummaryResponse, GoalResponse, UpcomingBill } from "../../api/types";
import { formatCentavos, formatDayMonth, monthRange } from "../../lib/formatters";
import { budgetTone, toBand, worstBand, type BudgetBand, type MeterTone } from "../../lib/pisoMood";

/**
 * What Home says and lists, kept apart from how it looks so spec §5's Dashboard table can be
 * pinned without rendering. Every figure here is the server's; the only arithmetic is calendar
 * (days left) and sorting or filtering lists already fetched.
 */

type BudgetItem = NonNullable<BudgetSummaryResponse["items"]>[number];

/** Days left in `month`, today included; null once the month has closed. `today` is Manila `YYYY-MM-DD`. */
export function daysLeftInMonth(month: string, today: string): number | null {
  const thisMonth = today.slice(0, 7);
  if (month < thisMonth) return null;
  const last = Number(monthRange(month).to.slice(8));
  return month > thisMonth ? last : last - Number(today.slice(8)) + 1;
}

const MOOD_PREFIX: Partial<Record<PisoState, string>> = {
  worried: "Close to the limit · ",
  overBudget: "A budget ran over · ",
};

/** The hero's one line, tied to Piso's mood. Never the only signal of it, and never a scolding. */
export function statusLine({
  mood,
  safeToSpend,
  hasBudget,
  daysLeft,
}: {
  mood: PisoState;
  /** The server's `safeToSpend`, centavos; negative once the month is over in total. */
  safeToSpend: number;
  hasBudget: boolean;
  daysLeft: number | null;
}): string {
  if (mood === "empty") return "Nothing logged yet. Tap + to add your first expense.";
  if (!hasBudget) return "No budget set for this month";
  if (safeToSpend < 0) return `Over by ${formatCentavos(-safeToSpend)}`;
  const left = formatCentavos(safeToSpend);
  const tail =
    daysLeft === null
      ? `Closed ${left} under budget`
      : `${left} left for ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
  return (MOOD_PREFIX[mood] ?? "") + tail;
}

export interface AttentionRow {
  key: string;
  label: string;
  sub: string;
  href: "/(app)/budgets" | "/(app)/more/recurring";
  /** Budget rows: the meter. */
  tone?: MeterTone;
  percent?: number;
  /** Bill rows: what is due, centavos in the base currency. */
  amount?: number;
}

const BILL_WINDOW_DAYS = 7;

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Budgets the server bands `WARNING` or `OVER_BUDGET`, fullest first, then bills due from today
 * through the next seven days. Empty means the section is not drawn.
 */
export function needsAttention(
  items: readonly BudgetItem[],
  bills: readonly UpcomingBill[],
  today: string,
): AttentionRow[] {
  const budgets = items
    .filter((b) => toBand(b.status) !== "ON_TRACK")
    .sort((a, b) => (b.percentUsed ?? 0) - (a.percentUsed ?? 0))
    .map((b): AttentionRow => {
      const remaining = b.remaining ?? 0;
      return {
        key: `budget-${b.categoryId ?? b.categoryName}`,
        label: b.categoryName ?? "Budget",
        sub:
          remaining < 0
            ? `Over by ${formatCentavos(-remaining)}`
            : `${formatCentavos(b.spent ?? 0)} of ${formatCentavos(b.budgeted ?? 0)} · ${Math.round(b.percentUsed ?? 0)}%`,
        href: "/(app)/budgets",
        tone: budgetTone(toBand(b.status)),
        percent: b.percentUsed ?? 0,
      };
    });

  const until = addDays(today, BILL_WINDOW_DAYS);
  const due = bills
    .filter((b) => !!b.dueDate && b.dueDate >= today && b.dueDate <= until)
    .map(
      (b, i): AttentionRow => ({
        key: `bill-${b.id}-${b.dueDate}-${i}`,
        label: b.name ?? "Bill",
        sub: `Due ${formatDayMonth(b.dueDate)}`,
        href: "/(app)/more/recurring",
        amount: b.amountInBaseCurrency ?? b.amount ?? 0,
      }),
    );

  return [...budgets, ...due];
}

/** The `Celebrate` events Home holds: each completed goal, and a closed month with no budget over. */
export function celebrationsFor({
  month,
  today,
  bands,
  goals,
}: {
  month: string;
  today: string;
  bands: readonly BudgetBand[];
  goals: readonly Pick<GoalResponse, "id" | "status">[];
}): string[] {
  const events = goals.filter((g) => g.status === "COMPLETED").map((g) => `goal-${g.id}`);
  if (closedUnderBudget(month, today, bands)) events.push(`month-${month}`);
  return events;
}

/** A month that has ended with budgets set and none of them over, by the server's banding. */
export function closedUnderBudget(month: string, today: string, bands: readonly BudgetBand[]): boolean {
  return daysLeftInMonth(month, today) === null && bands.length > 0 && worstBand(bands) !== "OVER_BUDGET";
}

/**
 * The hero meter: the month's budgeted spend against its total budget. The server publishes both
 * totals but no overall percentage, so the fill is their ratio — a bar width, never a band. Its
 * tone is the worst server band on screen, as spec §3 asks, so colour never comes from the ratio.
 */
export function budgetMeter(
  summary: Pick<BudgetSummaryResponse, "totalSpent" | "totalBudgeted"> | undefined,
  bands: readonly BudgetBand[],
): { percent: number; tone: MeterTone; caption: string } | null {
  const budgeted = summary?.totalBudgeted ?? 0;
  if (!summary || budgeted <= 0) return null;
  const spent = summary.totalSpent ?? 0;
  return {
    percent: Math.round((spent * 100) / budgeted),
    tone: budgetTone(worstBand(bands) ?? "ON_TRACK"),
    caption: `${formatCentavos(spent)} of ${formatCentavos(budgeted)} budget`,
  };
}
