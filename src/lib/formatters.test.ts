import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { currentMonth, formatCentavos, formatDate, formatDateOnly, formatDayMonth, monthRange, nowForApi, parseAmountToCentavos } from "./formatters";

/**
 * The integer-centavo pair. The point of the representation is that no amount ever touches a
 * float, so the tests assert the two arithmetic shapes that would break that guarantee:
 * `cents / 100` on the way out and `parseFloat(x) * 100` on the way in. The second is not a
 * theoretical hazard: `parseFloat("0.29") * 100` is 28.999999999999996, a centavo short of the
 * amount the user typed, and `parseFloat("1.005") * 100` is 100.49999999999999, which rounds the
 * wrong way. Which literals are affected is not predictable by eye — 150.75 happens to survive —
 * so the string route is the only one that can be relied on.
 */
describe("formatCentavos", () => {
  it("renders an integer centavo amount with the peso sign and two decimals", () => {
    expect(formatCentavos(15075)).toBe("₱150.75");
    expect(formatCentavos(123456)).toBe("₱1,234.56");
  });

  it("keeps a leading zero in the centavos", () => {
    expect(formatCentavos(15005)).toBe("₱150.05");
    expect(formatCentavos(15000)).toBe("₱150.00");
  });

  it("renders amounts under a peso, and zero", () => {
    expect(formatCentavos(7)).toBe("₱0.07");
    expect(formatCentavos(0)).toBe("₱0.00");
  });

  it("renders a negative amount with the sign outside the peso", () => {
    expect(formatCentavos(-15075)).toBe("-₱150.75");
  });

  it("does not render NaN or a missing amount to the user", () => {
    expect(formatCentavos(Number.NaN)).toBe("₱0.00");
    expect(formatCentavos(null)).toBe("₱0.00");
    expect(formatCentavos(undefined)).toBe("₱0.00");
  });

  it("is exact where dividing by 100 would not be", () => {
    expect(formatCentavos(80070)).toBe("₱800.70");
    expect(formatCentavos(1_000_000_00 + 1)).toBe("₱1,000,000.01");
  });
});

describe("parseAmountToCentavos", () => {
  it("parses 150.75 to exactly 15075, from both a string and a number", () => {
    expect(parseAmountToCentavos("150.75")).toBe(15075);
    expect(parseAmountToCentavos(150.75)).toBe(15075);
  });

  it("is exact on the amounts the float route gets wrong", () => {
    // The float route this replaces, spelled out so the reason is not lost.
    expect(Math.trunc(parseFloat("0.29") * 100)).toBe(28);
    expect(parseAmountToCentavos("0.29")).toBe(29);

    expect(Math.round(parseFloat("1.005") * 100)).toBe(100);
    expect(parseAmountToCentavos("1.005")).toBe(101);
  });

  it("parses whole pesos and a bare centavo tail", () => {
    expect(parseAmountToCentavos("150")).toBe(15000);
    expect(parseAmountToCentavos("150.5")).toBe(15050);
    expect(parseAmountToCentavos(".75")).toBe(75);
    expect(parseAmountToCentavos("0")).toBe(0);
  });

  it("accepts what a user types: peso sign, separators, spaces, a sign", () => {
    expect(parseAmountToCentavos(" ₱1,234.56 ")).toBe(123456);
    expect(parseAmountToCentavos("+20")).toBe(2000);
    expect(parseAmountToCentavos("-20.05")).toBe(-2005);
  });

  it("rounds a third decimal place half-up, away from zero", () => {
    expect(parseAmountToCentavos("1.005")).toBe(101);
    expect(parseAmountToCentavos("1.004")).toBe(100);
    expect(parseAmountToCentavos("-1.005")).toBe(-101);
    expect(parseAmountToCentavos("0.999")).toBe(100);
  });

  it("returns null rather than 0 for anything that is not an amount", () => {
    // 0 would post as a free expense; null can fail validation.
    expect(parseAmountToCentavos("")).toBeNull();
    expect(parseAmountToCentavos("abc")).toBeNull();
    expect(parseAmountToCentavos("1.2.3")).toBeNull();
    expect(parseAmountToCentavos("₱")).toBeNull();
    expect(parseAmountToCentavos(null)).toBeNull();
    expect(parseAmountToCentavos(undefined)).toBeNull();
    expect(parseAmountToCentavos(Number.NaN)).toBeNull();
  });

  it("returns null above the safe-integer range instead of a wrong number", () => {
    expect(parseAmountToCentavos("999999999999999999")).toBeNull();
  });

  it("round-trips through formatCentavos", () => {
    for (const typed of ["0.01", "9.90", "150.75", "1234.56", "1000000.01"]) {
      const cents = parseAmountToCentavos(typed);
      expect(cents).not.toBeNull();
      expect(formatCentavos(cents as number).replace(/[₱,]/g, "")).toBe(
        Number(typed).toFixed(2),
      );
    }
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
