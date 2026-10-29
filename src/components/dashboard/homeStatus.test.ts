import { describe, expect, it } from "@jest/globals";
import { budgetMeter, celebrationsFor, daysLeftInMonth, needsAttention, statusLine } from "./homeStatus";

/** Spec §5, Dashboard: the hero's status line per mood, and what "Needs attention" lists. */

describe("statusLine", () => {
  const base = { safeToSpend: 80000, hasBudget: true, daysLeft: 9 };

  it("says what is left and for how long while on track", () => {
    expect(statusLine({ ...base, mood: "resting" })).toBe("₱800.00 left for 9 days");
  });

  it("singularises the last day", () => {
    expect(statusLine({ ...base, mood: "resting", daysLeft: 1 })).toBe("₱800.00 left for 1 day");
  });

  it("gives a heads-up when a budget is close", () => {
    expect(statusLine({ ...base, mood: "worried" })).toBe("Close to the limit · ₱800.00 left for 9 days");
  });

  it("says one budget ran over while the month is still under overall", () => {
    expect(statusLine({ ...base, mood: "overBudget" })).toBe("A budget ran over · ₱800.00 left for 9 days");
  });

  it("states the overspend plainly when the month is over in total", () => {
    expect(statusLine({ ...base, mood: "overBudget", safeToSpend: -120000 })).toBe("Over by ₱1,200.00");
  });

  it("celebrates a month that closed under budget", () => {
    expect(statusLine({ ...base, mood: "cheer", daysLeft: null })).toBe("Closed ₱800.00 under budget");
  });

  it("invites the first expense on an empty account", () => {
    expect(statusLine({ ...base, mood: "empty", hasBudget: false })).toBe(
      "Nothing logged yet. Tap + to add your first expense.",
    );
  });

  it("does not invent a budget that was never set", () => {
    expect(statusLine({ ...base, mood: "resting", hasBudget: false })).toBe("No budget set for this month");
  });
});

describe("daysLeftInMonth", () => {
  it("counts today among the days left", () => {
    expect(daysLeftInMonth("2026-10", "2026-10-23")).toBe(9);
    expect(daysLeftInMonth("2026-10", "2026-10-31")).toBe(1);
  });

  it("knows February's length", () => {
    expect(daysLeftInMonth("2028-02", "2028-02-01")).toBe(29);
  });

  it("returns null for a month that has closed", () => {
    expect(daysLeftInMonth("2026-09", "2026-10-01")).toBeNull();
  });
});

describe("needsAttention", () => {
  const items = [
    { categoryId: 1, categoryName: "Food", spent: 13000, budgeted: 10000, remaining: -3000, percentUsed: 130, status: "OVER_BUDGET" },
    { categoryId: 2, categoryName: "Rent", spent: 9000, budgeted: 10000, remaining: 1000, percentUsed: 90, status: "WARNING" },
    { categoryId: 3, categoryName: "Fun", spent: 1000, budgeted: 10000, remaining: 9000, percentUsed: 10, status: "ON_TRACK" },
  ];
  const bills = [
    { id: 1, name: "Netflix", dueDate: "2026-10-23", amount: 54900 },
    { id: 2, name: "Gym", dueDate: "2026-10-30", amount: 150000 },
    { id: 3, name: "Rent", dueDate: "2026-10-31", amount: 1500000 },
    { id: 4, name: "Water", dueDate: "2026-10-22", amount: 30000 },
  ];

  it("lists only the server's WARNING and OVER_BUDGET lines, fullest first", () => {
    const rows = needsAttention([...items].reverse(), [], "2026-10-23");
    expect(rows.map((r) => r.label)).toEqual(["Food", "Rent"]);
    expect(rows[0]).toMatchObject({ tone: "over", percent: 130, sub: "Over by ₱30.00" });
    expect(rows[1]).toMatchObject({ tone: "warning", percent: 90, sub: "₱90.00 of ₱100.00 · 90%" });
  });

  it("adds bills due today through the next seven days, and nothing past or later", () => {
    const rows = needsAttention([], bills, "2026-10-23");
    expect(rows.map((r) => r.label)).toEqual(["Netflix", "Gym"]);
    expect(rows[0]).toMatchObject({ amount: 54900, sub: "Due Oct 23" });
    expect(rows[0].tone).toBeUndefined();
  });

  it("is empty when nothing needs attention", () => {
    expect(needsAttention([items[2]], [], "2026-10-23")).toEqual([]);
  });
});

describe("celebrationsFor", () => {
  const goals = [
    { id: 7, status: "COMPLETED" as const },
    { id: 8, status: "ON_TRACK" as const },
  ];

  it("celebrates each completed goal", () => {
    expect(celebrationsFor({ month: "2026-10", today: "2026-10-23", bands: [], goals })).toEqual(["goal-7"]);
  });

  it("celebrates a closed month with no budget over", () => {
    expect(
      celebrationsFor({ month: "2026-09", today: "2026-10-23", bands: ["ON_TRACK", "WARNING"], goals: [] }),
    ).toEqual(["month-2026-09"]);
  });

  it("does not celebrate a month still running, one with a budget over, or one with no budgets", () => {
    const today = "2026-10-23";
    expect(celebrationsFor({ month: "2026-10", today, bands: ["ON_TRACK"], goals: [] })).toEqual([]);
    expect(celebrationsFor({ month: "2026-09", today, bands: ["OVER_BUDGET"], goals: [] })).toEqual([]);
    expect(celebrationsFor({ month: "2026-09", today, bands: [], goals: [] })).toEqual([]);
  });
});

describe("budgetMeter", () => {
  it("measures the month against its total budget, toned by the worst band", () => {
    expect(budgetMeter({ totalSpent: 90000, totalBudgeted: 100000 }, ["ON_TRACK", "WARNING"])).toEqual({
      percent: 90,
      tone: "warning",
      caption: "₱900.00 of ₱1,000.00 budget",
    });
  });

  it("is absent without a budget", () => {
    expect(budgetMeter(undefined, [])).toBeNull();
    expect(budgetMeter({ totalSpent: 500, totalBudgeted: 0 }, [])).toBeNull();
  });
});
