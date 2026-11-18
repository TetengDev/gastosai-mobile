import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { formatDayMonth, nowForApi } from "../../lib/formatters";
import {
  billMonths,
  budgetMeter,
  celebrationsFor,
  daysLeftInMonth,
  heroMood,
  isPaidUp,
  needsAttention,
  previousMonth,
  statusLine,
} from "./homeStatus";

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
      "Nothing logged yet. Your first expense goes straight into Piso's slot.",
    );
  });

  it("does not invent a budget that was never set", () => {
    expect(statusLine({ ...base, mood: "resting", hasBudget: false })).toBe("No budget set for this month.");
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
    const rows = needsAttention([...items].reverse(), { month: "2026-10", upcoming: [] }, "2026-10-23");
    expect(rows.map((r) => r.label)).toEqual(["Food", "Rent"]);
    expect(rows[0]).toMatchObject({ tone: "over", percent: 130, sub: "Over by ₱30.00" });
    expect(rows[1]).toMatchObject({ tone: "warning", percent: 90, sub: "₱90.00 of ₱100.00 · 90%" });
  });

  it("adds bills due today through the next seven days, and nothing past or later", () => {
    const rows = needsAttention([], { month: "2026-10", upcoming: bills }, "2026-10-23");
    expect(rows.map((r) => r.label)).toEqual(["Netflix", "Gym"]);
    expect(rows[0]).toMatchObject({ amount: 54900, sub: "Due Oct 23" });
    expect(rows[0].tone).toBeUndefined();
  });

  it("is empty when nothing needs attention", () => {
    expect(needsAttention([items[2]], { month: "2026-10", upcoming: [] }, "2026-10-23")).toEqual([]);
  });
});

describe("celebrationsFor", () => {
  const goals = [
    { id: 7, status: "COMPLETED" as const },
    { id: 8, status: "ON_TRACK" as const },
  ];
  const today = "2026-10-23";

  it("celebrates each completed goal", () => {
    expect(celebrationsFor({ month: "2026-10", today, previousBands: [], goals })).toEqual(["goal-7"]);
  });

  /**
   * Final review on TEN-444: "a month closes" is the month that just ended, seen from the current
   * month — not whichever past month the user steps back to, years-old ones included.
   */
  it("on the current month, celebrates the previous month closing with no budget over", () => {
    expect(
      celebrationsFor({ month: "2026-10", today, previousBands: ["ON_TRACK", "WARNING"], goals: [] }),
    ).toEqual(["month-2026-09"]);
  });

  it("does not celebrate a previous month with a budget over, or one with no budgets", () => {
    expect(celebrationsFor({ month: "2026-10", today, previousBands: ["ON_TRACK", "OVER_BUDGET"], goals: [] })).toEqual([]);
    expect(celebrationsFor({ month: "2026-10", today, previousBands: [], goals: [] })).toEqual([]);
  });

  it("never celebrates a month for viewing a past month directly", () => {
    expect(celebrationsFor({ month: "2026-09", today, previousBands: ["ON_TRACK"], goals: [] })).toEqual([]);
    expect(celebrationsFor({ month: "2023-04", today, previousBands: ["ON_TRACK"], goals: [] })).toEqual([]);
  });

  /** TEN-505: the queue plays them in this order, so the month goes first. */
  it("puts the month that closed ahead of the goals", () => {
    expect(celebrationsFor({ month: "2026-10", today, previousBands: ["ON_TRACK"], goals })).toEqual([
      "month-2026-09",
      "goal-7",
    ]);
  });

  it("names December of last year in January", () => {
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(
      celebrationsFor({ month: "2027-01", today: "2027-01-02", previousBands: ["ON_TRACK"], goals: [] }),
    ).toEqual(["month-2026-12"]);
  });
});

/** TEN-505: Piso flipped resting -> worried mid-load as the budgets arrived after the report. */
describe("heroMood", () => {
  it("holds resting while any of its inputs is still loading", () => {
    expect(heroMood({ loading: true, bands: ["WARNING"], hasExpenses: true })).toBe("resting");
    expect(heroMood({ loading: true, bands: [], hasExpenses: false })).toBe("resting");
  });

  it("is the real mood once they settle", () => {
    expect(heroMood({ loading: false, bands: ["WARNING"], hasExpenses: true })).toBe("worried");
    expect(heroMood({ loading: false, bands: [], hasExpenses: false })).toBe("empty");
  });
});

describe("budgetMeter", () => {
  it("measures the month against its total budget, toned by the worst band", () => {
    expect(budgetMeter({ totalSpent: 90000, totalBudgeted: 100000, percentUsed: 90 }, ["ON_TRACK", "WARNING"])).toEqual({
      percent: 90,
      tone: "warning",
      caption: "₱900.00 of ₱1,000.00 budgeted · 90%",
    });
  });

  it("is absent without a budget", () => {
    expect(budgetMeter(undefined, [])).toBeNull();
    expect(budgetMeter({ totalSpent: 500, totalBudgeted: 0 }, [])).toBeNull();
  });

  /** TEN-540: contract 3.5.0 publishes the overall percentage; Home reads it rather than dividing. */
  it("reads the server's percentUsed, not its own spent / budgeted", () => {
    // 812,345 / 1,500,000 is 54%; the server says 61, and the server wins.
    expect(budgetMeter({ totalSpent: 812_345, totalBudgeted: 1_500_000, percentUsed: 61 }, ["ON_TRACK"])).toEqual({
      percent: 61,
      tone: "onTrack",
      caption: "₱8,123.45 of ₱15,000.00 budgeted · 61%",
    });
  });

  it("keeps its own guard: 0% with nothing budgeted is no meter, not an empty one", () => {
    expect(budgetMeter({ totalSpent: 0, totalBudgeted: 0, percentUsed: 0 }, [])).toBeNull();
  });
});

/**
 * Review finding on TEN-444: "due within 7 days" read only the selected month's upcoming bills, so
 * from about the 25th a bill due on the 1st-7th of next month (rent, usually) never showed.
 */
describe("bills across the month end", () => {
  it("asks for next month too when the seven-day window crosses into it", () => {
    expect(billMonths("2026-10", "2026-10-28")).toEqual(["2026-10", "2026-11"]);
    expect(billMonths("2026-12", "2026-12-30")).toEqual(["2026-12", "2027-01"]);
  });

  it("asks for the selected month alone when the window stays inside it", () => {
    expect(billMonths("2026-10", "2026-10-24")).toEqual(["2026-10"]);
    expect(billMonths("2026-09", "2026-10-28")).toEqual(["2026-09"]);
  });

  it("lists a bill due on the 2nd of next month on the 28th, and not one due on the 9th", () => {
    const october = [{ id: 1, name: "Internet", dueDate: "2026-10-30", amount: 159900 }];
    const november = [
      { id: 2, name: "Rent", dueDate: "2026-11-02", amount: 1500000 },
      { id: 3, name: "Gym", dueDate: "2026-11-09", amount: 150000 },
      // The same occurrence returned by both months' answers is listed once.
      { id: 1, name: "Internet", dueDate: "2026-10-30", amount: 159900 },
    ];
    const rows = needsAttention([], { month: "2026-10", upcoming: [...october, ...november] }, "2026-10-28");
    expect(rows.map((r) => r.label)).toEqual(["Internet", "Rent"]);
  });
});

/**
 * TEN-540, contract 3.5.0: a bill's paid state, joined from `/recurring` by id (R2). Each case reads
 * "today" off a fake clock through `nowForApi`, at an instant where Manila's date is not UTC's or
 * New York's (jest runs in New York), so a device-zone date would land on the wrong day.
 */
describe("overdue bills", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  /** The Manila date at `instant`, as Home computes it. */
  function manilaToday(instant: string): string {
    jest.useFakeTimers({ now: new Date(instant) });
    return nowForApi().slice(0, 10);
  }

  const meralco = (dueDate: string) => ({ id: 7, name: "Meralco", dueDate, amount: 250_000 });
  const unpaid = (lastPaidMonth: string | null) => [{ id: 7, name: "Meralco", paidThisMonth: false, lastPaidMonth }];

  it("keeps a bill whose due date this month has passed unpaid, marked overdue, with Mark paid", () => {
    const today = manilaToday("2026-11-17T20:00:00Z"); // Nov 18, 04:00 in Manila; Nov 17 in UTC and New York
    expect(today).toBe("2026-11-18");
    const rows = needsAttention(
      [],
      { month: "2026-11", upcoming: [meralco("2026-11-10")], upcomingPrevious: [], recurring: unpaid("2026-10") },
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      label: "Meralco",
      sub: `Overdue · was due ${formatDayMonth("2026-11-10")}`,
      amount: 250_000,
      href: "/(app)/more/recurring",
      markPaid: { id: 7 },
      overdue: true,
    });
    expect(rows[0].sub).toBe("Overdue · was due Nov 10");
  });

  it("lists nothing for a bill paid this month, past due date or upcoming (R5)", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    const paid = [{ id: 7, name: "Meralco", paidThisMonth: true, lastPaidMonth: "2026-11" }];
    expect(
      needsAttention(
        [],
        { month: "2026-11", upcoming: [meralco("2026-11-10"), meralco("2026-11-20")], upcomingPrevious: [], recurring: paid },
        today,
      ),
    ).toEqual([]);
  });

  it("treats a lastPaidMonth at or after this month as nothing overdue", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    const ahead = [{ id: 7, name: "Meralco", paidThisMonth: false, lastPaidMonth: "2026-12" }];
    const rows = needsAttention(
      [],
      { month: "2026-11", upcoming: [meralco("2026-11-10")], upcomingPrevious: [meralco("2026-10-10")], recurring: ahead },
      today,
    );
    expect(rows).toEqual([]);
  });

  /** Fix round 1: web's paidUp. A month marked ahead covers this month's coming dates too. */
  it("hides a bill's coming date this month, and its Mark paid, when it is marked at or after this month", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    const ahead = [{ id: 7, name: "Meralco", paidThisMonth: false, lastPaidMonth: "2026-12" }];
    expect(
      needsAttention([], { month: "2026-11", upcoming: [meralco("2026-11-20")], upcomingPrevious: [], recurring: ahead }, today),
    ).toEqual([]);
    expect(isPaidUp(ahead[0], "2026-11")).toBe(true);
    expect(isPaidUp({ paidThisMonth: false, lastPaidMonth: "2026-10" }, "2026-11")).toBe(false);
    expect(isPaidUp({ paidThisMonth: true, lastPaidMonth: null }, "2026-11")).toBe(true);
  });

  it("offers Mark paid only on a bill /recurring knows, as web does", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    // Water is in /upcoming but not in the list: its paid state is unknown, so it is listed as due
    // and not markable, and a missed date of its is not overdue.
    const water = (dueDate: string) => ({ id: 9, name: "Water", dueDate, amount: 30_000 });
    const rows = needsAttention(
      [],
      { month: "2026-11", upcoming: [water("2026-11-10"), water("2026-11-20")], upcomingPrevious: [], recurring: unpaid("2026-10") },
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sub).toBe("Due Nov 20");
    expect(rows[0].markPaid).toBeUndefined();
  });

  it("skips a bill without an id rather than joining it to a list entry without one", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    expect(
      needsAttention(
        [],
        {
          month: "2026-11",
          upcoming: [{ name: "Ghost", dueDate: "2026-11-10", amount: 1_000 }],
          upcomingPrevious: [],
          recurring: [{ name: "Ghost", paidThisMonth: false, lastPaidMonth: "2026-10" }],
        },
        today,
      ),
    ).toEqual([]);
  });

  it("flags a bill last paid before the previous month, once the 1st has passed", () => {
    const today = manilaToday("2026-11-02T18:00:00Z"); // Nov 3, 02:00 in Manila
    expect(today).toBe("2026-11-03");
    const rows = needsAttention(
      [],
      {
        month: "2026-11",
        // Due later this month, outside the seven-day window: only last month makes it a row.
        upcoming: [meralco("2026-11-20")],
        upcomingPrevious: [meralco("2026-10-20")],
        recurring: unpaid("2026-09"),
      },
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Meralco", sub: "Overdue · not paid last month", markPaid: { id: 7 }, overdue: true });
  });

  it("does not flag a bill that was paid last month", () => {
    const today = manilaToday("2026-11-02T18:00:00Z");
    expect(
      needsAttention(
        [],
        { month: "2026-11", upcoming: [meralco("2026-11-20")], upcomingPrevious: [meralco("2026-10-20")], recurring: unpaid("2026-10") },
        today,
      ),
    ).toEqual([]);
  });

  it("does not flag a never-marked bill for last month on the 1st (R1)", () => {
    const today = manilaToday("2026-10-31T16:30:00Z"); // Nov 1, 00:30 in Manila; still Oct 31 in UTC
    expect(today).toBe("2026-11-01");
    expect(
      needsAttention(
        [],
        { month: "2026-11", upcoming: [meralco("2026-11-20")], upcomingPrevious: [meralco("2026-10-20")], recurring: unpaid(null) },
        today,
      ),
    ).toEqual([]);
  });

  it("does not flag last month for a bill the server did not have due last month (R3)", () => {
    const today = manilaToday("2026-11-02T18:00:00Z");
    // A yearly bill paid in January: not due in October, so October is not unpaid.
    expect(
      needsAttention(
        [],
        { month: "2026-11", upcoming: [meralco("2026-11-20")], upcomingPrevious: [], recurring: unpaid("2026-01") },
        today,
      ),
    ).toEqual([]);
  });

  it("lists a bill once, at its latest missed date, and drops its upcoming rows (R4)", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    const rows = needsAttention(
      [],
      {
        month: "2026-11",
        upcoming: [meralco("2026-11-04"), meralco("2026-11-11"), meralco("2026-11-18")],
        // Unpaid last month too: still one row, and it names this month's miss.
        upcomingPrevious: [meralco("2026-10-28")],
        recurring: unpaid("2026-09"),
      },
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sub).toBe("Overdue · was due Nov 11");
  });

  it("puts budgets first, then overdue bills, then upcoming ones", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    const budget = { categoryId: 1, categoryName: "Food", spent: 13000, budgeted: 10000, remaining: -3000, percentUsed: 130, status: "OVER_BUDGET" };
    const rows = needsAttention(
      [budget],
      {
        month: "2026-11",
        upcoming: [{ id: 8, name: "Netflix", dueDate: "2026-11-20", amount: 54_900 }, meralco("2026-11-10")],
        upcomingPrevious: [],
        recurring: [...unpaid("2026-10"), { id: 8, name: "Netflix", paidThisMonth: false, lastPaidMonth: "2026-10" }],
      },
      today,
    );
    expect(rows.map((r) => r.label)).toEqual(["Food", "Meralco", "Netflix"]);
    expect(rows[2]).toMatchObject({ sub: "Due Nov 20", markPaid: { id: 8 } });
    expect(rows[2].overdue).toBeUndefined();
    expect(rows[0].markPaid).toBeUndefined();
  });

  it("gives a row due next month no Mark paid, and keeps it for a bill paid this month (R5, R6)", () => {
    const today = manilaToday("2026-10-27T20:00:00Z"); // Oct 28 in Manila
    const rows = needsAttention(
      [],
      {
        month: "2026-10",
        upcoming: [meralco("2026-10-30"), meralco("2026-11-01")],
        upcomingPrevious: [],
        recurring: [{ id: 7, name: "Meralco", paidThisMonth: true, lastPaidMonth: "2026-10" }],
      },
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sub).toBe("Due Nov 1");
    expect(rows[0].markPaid).toBeUndefined();
  });

  it("falls back to upcoming rows alone, without Mark paid, when /recurring did not load (R2)", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    const rows = needsAttention(
      [],
      { month: "2026-11", upcoming: [meralco("2026-11-10"), meralco("2026-11-20")], upcomingPrevious: [meralco("2026-10-20")] },
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sub: "Due Nov 20" });
    expect(rows[0].markPaid).toBeUndefined();
  });

  it("shows no overdue rows on a past month's view (R7)", () => {
    const today = manilaToday("2026-11-17T20:00:00Z");
    // October viewed in November: an unpaid October date and an unpaid September would both be
    // rows on the current month's view.
    expect(
      needsAttention(
        [],
        { month: "2026-10", upcoming: [meralco("2026-10-10")], upcomingPrevious: [meralco("2026-09-10")], recurring: unpaid("2026-08") },
        today,
      ),
    ).toEqual([]);
  });
});
