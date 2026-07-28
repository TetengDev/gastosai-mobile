import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { currentMonth } from "../lib/formatters";

interface MonthState {
  /** `YYYY-MM`, the shape every month-scoped endpoint expects. */
  month: string;
  setMonth: (month: string) => void;
  /** Step by whole months. Negative goes back. */
  shiftMonth: (delta: number) => void;
  isCurrentMonth: boolean;
}

const MonthContext = createContext<MonthState | null>(null);

/**
 * Arithmetic on `YYYY-MM` as numbers rather than through `Date`.
 *
 * Constructing a `Date` and calling `setMonth` is the usual approach and it is wrong here: it
 * resolves in the *device's* timezone, so a phone in New York stepping back from `2026-07` lands
 * on June or May depending on the hour. Months are a calendar concept in `Asia/Manila` for this
 * app (CLAUDE.md §3) and never need a clock.
 */
function shift(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  // Work in months-since-year-zero so December→January carries without special cases.
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * The month Home, Expenses and Budgets are all looking at.
 *
 * Shared rather than per-screen on purpose: changing month on Home and then finding Budgets still
 * on the old one is precisely the kind of disorientation this release exists to remove. One
 * selection, three screens.
 *
 * Not persisted. Reopening the app should land on today, not on wherever you were browsing last
 * week — the common case is recording spend now.
 */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);

  const shiftMonth = useCallback((delta: number) => {
    setMonth((prev) => shift(prev, delta));
  }, []);

  const value = useMemo<MonthState>(
    () => ({ month, setMonth, shiftMonth, isCurrentMonth: month === currentMonth() }),
    [month, shiftMonth],
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth(): MonthState {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used inside MonthProvider");
  return ctx;
}

/** Exported for tests — the calendar arithmetic is the part worth pinning. */
export const shiftMonthString = shift;
