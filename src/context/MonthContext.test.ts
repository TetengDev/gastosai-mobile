import { describe, expect, it } from "@jest/globals";
import { shiftMonthString } from "./MonthContext";

/**
 * Month stepping is the whole point of v0.6 — before it, six months of data were unreachable — so
 * the arithmetic is worth pinning rather than trusting.
 *
 * `jest.globalSetup.js` forces `TZ=America/New_York` for the whole run. That matters here: the
 * obvious implementation (`new Date(...).setMonth(...)`) resolves in the device timezone and drifts
 * across year and month boundaries. These cases pass only because the implementation treats
 * `YYYY-MM` as calendar arithmetic with no clock involved.
 */
describe("shiftMonthString", () => {
  it("steps back and forward within a year", () => {
    expect(shiftMonthString("2026-07", -1)).toBe("2026-06");
    expect(shiftMonthString("2026-07", 1)).toBe("2026-08");
    expect(shiftMonthString("2026-07", -6)).toBe("2026-01");
  });

  it("carries across the year boundary in both directions", () => {
    expect(shiftMonthString("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthString("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthString("2026-03", -14)).toBe("2025-01");
  });

  it("keeps the zero-padded YYYY-MM shape the API requires", () => {
    // A bare "2026-9" is rejected by /budgets/summary, which validates the format.
    expect(shiftMonthString("2026-10", -1)).toBe("2026-09");
    expect(shiftMonthString("2026-09", 1)).toBe("2026-10");
  });

  it("is a no-op at zero", () => {
    expect(shiftMonthString("2026-07", 0)).toBe("2026-07");
  });
});
