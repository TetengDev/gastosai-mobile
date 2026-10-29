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
 * The months whose `/recurring/upcoming` Home must read to cover the seven-day bill window: the
 * selected month, plus the next one once the window crosses the month end — otherwise a bill due
 * on the 1st (rent, usually) is invisible all through the last week of the month before.
 */
export function billMonths(month: string, today: string): string[] {
  const next = addDays(today, BILL_WINDOW_DAYS).slice(0, 7);
  return month === today.slice(0, 7) && next !== month ? [month, next] : [month];
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
  const seen = new Set<string>();
  const due = bills
    .filter((b) => !!b.dueDate && b.dueDate >= today && b.dueDate <= until)
    // Two months' answers can carry the same occurrence; list it once.
    .filter((b) => {
      const id = `${b.id}-${b.dueDate}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
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

/** `2027-01` -> `2026-12`. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/**
 * The `Celebrate` events Home holds: each completed goal, and — on the current month only — the
 * month that just closed, if it had budgets and the server banded none of them over. Stepping
 * back to a past month never celebrates it; `Celebrate`'s per-event key stops repeats.
 */
export function celebrationsFor({
  month,
  today,
  previousBands,
  goals,
}: {
  month: string;
  today: string;
  /** The server's bands for the month before `month`. */
  previousBands: readonly BudgetBand[];
  goals: readonly Pick<GoalResponse, "id" | "status">[];
}): string[] {
  const events = goals.filter((g) => g.status === "COMPLETED").map((g) => `goal-${g.id}`);
  const closedUnder = previousBands.length > 0 && worstBand(previousBands) !== "OVER_BUDGET";
  if (month === today.slice(0, 7) && closedUnder) events.push(`month-${previousMonth(month)}`);
  return events;
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
  const percent = Math.round((spent * 100) / budgeted);
  return {
    percent,
    tone: budgetTone(worstBand(bands) ?? "ON_TRACK"),
    // "budgeted": `totalSpent` counts budgeted categories only, unlike the hero figure above it,
    // which is all spend. Saying so keeps the two from reading as one number disagreeing.
    caption: `${formatCentavos(spent)} of ${formatCentavos(budgeted)} budgeted · ${percent}%`,
  };
}
