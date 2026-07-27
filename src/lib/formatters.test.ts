import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  currentMonth,
  formatCurrency,
  formatDate,
  formatDateOnly,
  formatDayMonth,
  nowForApi,
} from "./formatters";

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
