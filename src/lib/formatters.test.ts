import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { currentMonth, expenseAmounts, formatCurrency, formatDate, formatDateOnly, formatDayMonth, monthRange, nowForApi } from "./formatters";

describe("formatCurrency", () => {
  it("formats with the peso sign and two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("₱1,234.50");
  });

  it("accepts the string form the API can return", () => {
    expect(formatCurrency("150.75")).toBe("₱150.75");
  });

  it("does not render NaN to the user", () => {
    expect(formatCurrency("not-a-number")).toBe("₱0.00");
  });
});

describe("timezone pinning", () => {
  // The whole reason these helpers were ported rather than reused: a phone's timezone is
  // arbitrary. 01:00 in Manila is the PREVIOUS calendar day in New York and in UTC, so an
  // unpinned formatter shows the wrong day — and the backend rolls months up in Asia/Manila,
  // so that silently lands the expense in the wrong monthly total.
  const EARLY_MORNING_MANILA = "2026-06-26T01:00:00+08:00";
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "America/New_York";
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formatDate keeps the Manila calendar day", () => {
    expect(formatDate(EARLY_MORNING_MANILA)).toContain("Jun 26");
  });

  it("formatDayMonth keeps the Manila calendar day", () => {
    expect(formatDayMonth(EARLY_MORNING_MANILA)).toBe("Jun 26");
  });

  it("formatDateOnly keeps the Manila calendar day", () => {
    expect(formatDateOnly(EARLY_MORNING_MANILA)).toContain("Jun 26");
  });

  it("nowForApi emits an offset-less Manila wall-clock timestamp", () => {
    // The backend stores Manila wall-clock and accepts an offset-less value. Sending the
    // device's raw ISO string would record the wrong local time for anyone outside PHT.
    const value = nowForApi();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

    const manilaHour = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Manila",
    }).format(new Date());
    expect(value.slice(11, 13)).toBe(manilaHour);
  });

  it("currentMonth reports the Manila month", () => {
    const manila = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Asia/Manila",
    }).format(new Date());
    expect(currentMonth()).toBe(manila.slice(0, 7));
  });
});

/**
 * `monthRange` feeds `GET /expenses?from=&to=`, so an off-by-one silently drops the first or last
 * day of every month from the list. The whole test run is pinned to `TZ=America/New_York` by
 * `jest.globalSetup.js`, which is what makes the UTC construction load-bearing rather than
 * decorative.
 */
describe("monthRange", () => {
  it("covers 31-, 30- and 28-day months", () => {
    expect(monthRange("2026-07")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(monthRange("2026-06")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("handles a leap February", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("handles December without rolling into the next year", () => {
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

/**
 * A ¥1,500 expense rendered as "₱1,500.00" while its server-computed day total read ₱577.50 —
 * two figures for the same row, on the same screen, disagreeing. The conversion is the backend's;
 * this only picks the field that already holds it.
 */
describe("expenseAmounts", () => {
  it("uses the converted figure for a foreign-currency expense", () => {
    const { base, original } = expenseAmounts({
      amount: 1500,
      amountInBaseCurrency: 577.5,
      currency: "JPY",
    });
    expect(base).toBe(577.5);
    expect(original).toBe("1,500.00 JPY");
  });

  it("shows no original for a peso expense", () => {
    const { base, original } = expenseAmounts({
      amount: 140,
      amountInBaseCurrency: 140,
      currency: "PHP",
    });
    expect(base).toBe(140);
    expect(original).toBeNull();
  });

  it("falls back to amount when the API omits a base figure", () => {
    expect(expenseAmounts({ amount: 90 }).base).toBe(90);
    expect(expenseAmounts({}).base).toBe(0);
  });
});
