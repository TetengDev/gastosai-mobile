import { describe, expect, it } from "@jest/globals";
import { describeSubscription, timeRemaining, type SubscriptionResponse } from "./subscription";

/**
 * Everything this screen shows is derived here, so these tests are the screen's real coverage.
 *
 * The suite runs under `TZ=America/New_York` (jest.globalSetup.js), which is the point: an end
 * date just after Manila midnight must still read as the Manila day, and a countdown must not
 * change length because the phone moved.
 */

// 00:30 on 12 Sep in Manila — 11 Sep in New York. Rendering this as "Sep 11" would put the
// renewal a day early for anyone who travelled.
const ENDS = "2026-09-12T00:30:00+08:00";
const NOW = new Date("2026-09-01T00:30:00+08:00"); // 11 days before ENDS, to the minute

const sub = (over: Partial<SubscriptionResponse>): SubscriptionResponse => ({ ...over });

describe("timeRemaining", () => {
  it("counts whole days once more than a day is left", () => {
    expect(timeRemaining(ENDS, NOW)).toBe("11 days left");
    expect(timeRemaining(ENDS, new Date("2026-09-11T00:30:00+08:00"))).toBe("1 day left");
  });

  it("drops to hours inside the last day, rather than rounding up to a day", () => {
    // Ninety minutes left is not "1 day left" — that rounding is only ever noticed by the person
    // it costs.
    expect(timeRemaining(ENDS, new Date("2026-09-11T23:00:00+08:00"))).toBe("1 hour left");
    expect(timeRemaining(ENDS, new Date("2026-09-11T12:30:00+08:00"))).toBe("12 hours left");
  });

  it("says less than an hour rather than zero hours", () => {
    expect(timeRemaining(ENDS, new Date("2026-09-12T00:00:00+08:00"))).toBe(
      "less than an hour left",
    );
  });

  it("is null once the moment has passed, or when there is no date", () => {
    expect(timeRemaining(ENDS, new Date("2026-09-12T00:30:00+08:00"))).toBeNull();
    expect(timeRemaining(ENDS, new Date("2026-10-01T00:00:00+08:00"))).toBeNull();
    expect(timeRemaining(null, NOW)).toBeNull();
    expect(timeRemaining(undefined, NOW)).toBeNull();
    expect(timeRemaining("not a date", NOW)).toBeNull();
  });

  it("measures the gap, not the calendar, so the device zone cannot change it", () => {
    // Both arguments carry explicit offsets; the answer is a duration either way.
    expect(timeRemaining("2026-09-02T00:00:00+08:00", new Date("2026-09-01T00:00:00+08:00"))).toBe(
      "1 day left",
    );
  });
});

describe("describeSubscription", () => {
  it("shows an active plan with its renewal date and billing period", () => {
    const s = describeSubscription(
      sub({ plan: "PREMIUM", status: "ACTIVE", billingPeriod: "MONTHLY", currentPeriodEnd: ENDS }),
      NOW,
    );
    expect(s.plan).toBe("Premium");
    expect(s.status).toBe("Active");
    expect(s.detail).toContain("Sep 12"); // the Manila day, not New York's Sep 11
    expect(s.detail).toContain("Billed monthly");
    expect(s.tone).toBe("normal");
  });

  it("shows a trial's remaining time", () => {
    const s = describeSubscription(sub({ plan: "TRIAL", status: "TRIAL", currentPeriodEnd: ENDS }), NOW);
    expect(s.detail).toContain("11 days left");
    expect(s.detail).toContain("Sep 12");
    expect(s.tone).toBe("warn");
  });

  it("says plainly when a trial has run out", () => {
    const s = describeSubscription(
      sub({ plan: "TRIAL", status: "TRIAL", currentPeriodEnd: ENDS }),
      new Date("2026-10-01T00:00:00+08:00"),
    );
    expect(s.detail).toContain("ended");
    expect(s.tone).toBe("danger");
  });

  it("says an expired subscription is expired, not merely inactive", () => {
    const s = describeSubscription(sub({ plan: "PREMIUM", status: "EXPIRED", currentPeriodEnd: ENDS }));
    expect(s.status).toBe("Expired");
    expect(s.detail).toContain("Expired on");
    expect(s.tone).toBe("danger");
  });

  it("keeps cancelled distinct from expired, with the date access still runs to", () => {
    // The user paid for this period; telling them it is already over would be wrong.
    const s = describeSubscription(sub({ plan: "PREMIUM", status: "CANCELLED", currentPeriodEnd: ENDS }), NOW);
    expect(s.status).toBe("Cancelled");
    expect(s.detail).toContain("Sep 12");
    expect(s.tone).toBe("warn");
  });

  it("handles a free, inactive account", () => {
    const s = describeSubscription(sub({ plan: "FREE", status: "INACTIVE" }));
    expect(s.plan).toBe("Free");
    expect(s.detail).toBe("No active subscription.");
    expect(s.tone).toBe("normal");
  });

  it("admits it does not know rather than guessing a plan", () => {
    // Every field on the contract is optional, and an older app may meet a status it has never
    // heard of. Both must land somewhere honest.
    const empty = describeSubscription(undefined);
    expect(empty.plan).toBe("—");
    expect(empty.status).toBe("Unknown");
    expect(empty.detail).toContain("unavailable");

    const partial = describeSubscription(sub({ plan: "PREMIUM" }));
    expect(partial.plan).toBe("Premium");
    expect(partial.status).toBe("Unknown");
  });

  it("falls back to a bare status when the backend sends no period end", () => {
    expect(describeSubscription(sub({ plan: "PREMIUM", status: "ACTIVE" })).detail).toBe("Active");
  });
});
