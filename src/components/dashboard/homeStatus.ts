import type { PisoState } from "../../brand/Piso";
import type { BudgetSummaryResponse, GoalResponse, RecurringExpenseResponse, UpcomingBill } from "../../api/types";
import { formatCentavos, formatDayMonth, monthRange } from "../../lib/formatters";
import {
  budgetTone,
  pisoMoodFor,
  toBand,
  worstBand,
  type BudgetBand,
  type MeterTone,
  type PisoMoodInput,
} from "../../lib/pisoMood";

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

/**
 * The hero's Piso. Held at `resting` until every input has settled: the report, expenses and
 * budgets land at different moments, and without the hold Piso changed face as each one arrived.
 */
export function heroMood({ loading, ...input }: PisoMoodInput & { loading: boolean }): PisoState {
  return loading ? "resting" : pisoMoodFor(input);
}

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
  // Word for word with web's Dashboard (ruling R2, TEN-505).
  if (mood === "empty") return "Nothing logged yet. Your first expense goes straight into Piso's slot.";
  if (!hasBudget) return "No budget set for this month.";
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
  /** Bill rows the current month's mark covers (R6): overdue ones, and those due this month. */
  markPaid?: { id: number };
  /** Bill rows left unpaid: the sub-line is a warning. */
  overdue?: boolean;
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
 * Marked paid for `month` (`YYYY-MM`) or later. A `lastPaidMonth` at or after `month` means nothing
 * is overdue and nothing is left to mark, the same as `paidThisMonth`. Web's `paidUp`.
 */
export function isPaidUp(r: Pick<RecurringExpenseResponse, "paidThisMonth" | "lastPaidMonth">, month: string): boolean {
  return !!r.paidThisMonth || (r.lastPaidMonth != null && r.lastPaidMonth >= month);
}

/** A bill occurrence that can be joined (by id) and placed (by date); any other is skipped. */
type KnownBill = UpcomingBill & { id: number; dueDate: string };
const isKnown = (b: UpcomingBill): b is KnownBill => b.id != null && !!b.dueDate;

/**
 * Budgets the server bands `WARNING` or `OVER_BUDGET`, fullest first; then bills left unpaid; then
 * bills due from today through the next seven days. Empty means the section is not drawn.
 *
 * The paid state is the server's, joined by id, and only on the current month's view (R7). Without
 * it — `/recurring` failed or is loading — the bills are listed as they were before 3.5.0 (R2).
 */
export function needsAttention(
  items: readonly BudgetItem[],
  {
    month,
    upcoming,
    upcomingPrevious = [],
    recurring,
  }: {
    /** The month on screen, `YYYY-MM`. */
    month: string;
    /** `/recurring/upcoming` for each of `billMonths`. */
    upcoming: readonly UpcomingBill[];
    /** `/recurring/upcoming` for the month before today's: what was due last month (R3). */
    upcomingPrevious?: readonly UpcomingBill[];
    /** `/recurring`, the only source of `paidThisMonth` and `lastPaidMonth` (R2). */
    recurring?: readonly RecurringExpenseResponse[];
  },
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

  const thisMonth = today.slice(0, 7);
  const lastMonth = previousMonth(thisMonth);
  const state = month === thisMonth && recurring ? new Map(recurring.map((r) => [r.id, r])) : null;
  const inThisMonth = (b: KnownBill) => b.dueDate.slice(0, 7) === thisMonth;
  const billRow = (b: KnownBill, key: string, sub: string, markable: boolean): AttentionRow => ({
    key,
    label: b.name ?? "Bill",
    sub,
    href: "/(app)/more/recurring",
    amount: b.amountInBaseCurrency ?? b.amount ?? 0,
    ...(markable ? { markPaid: { id: b.id } } : {}),
  });
  const bills = upcoming.filter(isKnown);

  // One row per unpaid bill (R4), keyed by id. A mark at or after this month settles it.
  const overdue = new Map<number, AttentionRow>();
  if (state) {
    const unpaid = (id: number) => {
      const r = state.get(id);
      return r && !isPaidUp(r, thisMonth) ? r : null;
    };
    // Earliest first, so the latest missed date is the one a row ends up naming.
    const missed = bills
      .filter((b) => inThisMonth(b) && b.dueDate < today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const b of missed) {
      if (unpaid(b.id)) {
        overdue.set(b.id, {
          ...billRow(b, `overdue-${b.id}`, `Overdue · was due ${formatDayMonth(b.dueDate)}`, true),
          overdue: true,
        });
      }
    }
    // Last month, for a bill due then and last marked before it. Never marked is not unpaid (R1).
    for (const b of upcomingPrevious.filter(isKnown)) {
      const lastPaid = unpaid(b.id)?.lastPaidMonth;
      if (!overdue.has(b.id) && b.dueDate.slice(0, 7) === lastMonth && lastPaid && lastPaid < lastMonth) {
        overdue.set(b.id, { ...billRow(b, `overdue-${b.id}`, "Overdue · not paid last month", true), overdue: true });
      }
    }
  }

  const until = addDays(today, BILL_WINDOW_DAYS);
  const seen = new Set<string>();
  const due = bills
    .filter((b) => b.dueDate >= today && b.dueDate <= until)
    // Two months' answers can carry the same occurrence; list it once.
    .filter((b) => {
      const id = `${b.id}-${b.dueDate}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    // An unpaid bill is its overdue row alone (R4); a paid-up one has nothing left this month (R5).
    .filter((b) => {
      const r = state?.get(b.id);
      return !overdue.has(b.id) && !(inThisMonth(b) && r && isPaidUp(r, thisMonth));
    })
    .map((b, i) =>
      // Only a bill the list knows, and not next month's rows: this month's mark does not cover
      // them (R6).
      billRow(b, `bill-${b.id}-${b.dueDate}-${i}`, `Due ${formatDayMonth(b.dueDate)}`, !!state?.has(b.id) && inThisMonth(b)),
    );

  return [...budgets, ...overdue.values(), ...due];
}

/** `2027-01` -> `2026-12`. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/**
 * The `Celebrate` events Home holds, in the order they play: on the current month only, the month
 * that just closed, if it had budgets and the server banded none of them over; then each completed
 * goal. Stepping back to a past month never celebrates it; `Celebrate`'s per-event key stops repeats.
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
  const goalEvents = goals.filter((g) => g.status === "COMPLETED").map((g) => `goal-${g.id}`);
  const closedUnder = previousBands.length > 0 && worstBand(previousBands) !== "OVER_BUDGET";
  return month === today.slice(0, 7) && closedUnder ? [`month-${previousMonth(month)}`, ...goalEvents] : goalEvents;
}

/**
 * The hero meter: the month's budgeted spend against its total budget, filled to the server's
 * `percentUsed` (contract 3.5.0) — a bar width, never a band. The server sends 0 both for nothing
 * budgeted and for nothing spent, so "no budget" is still read off `totalBudgeted`. Its tone is the
 * worst server band on screen, as spec §3 asks.
 */
export function budgetMeter(
  summary: Pick<BudgetSummaryResponse, "totalSpent" | "totalBudgeted" | "percentUsed"> | undefined,
  bands: readonly BudgetBand[],
): { percent: number; tone: MeterTone; caption: string } | null {
  const budgeted = summary?.totalBudgeted ?? 0;
  if (!summary || budgeted <= 0) return null;
  const spent = summary.totalSpent ?? 0;
  const percent = summary.percentUsed ?? 0;
  return {
    percent,
    tone: budgetTone(worstBand(bands) ?? "ON_TRACK"),
    // "budgeted": `totalSpent` counts budgeted categories only, unlike the hero figure above it,
    // which is all spend. Saying so keeps the two from reading as one number disagreeing.
    caption: `${formatCentavos(spent)} of ${formatCentavos(budgeted)} budgeted · ${percent}%`,
  };
}
