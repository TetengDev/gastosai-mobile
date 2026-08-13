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

/**
 * The contract types every field as optional-but-not-nullable, while the backend really sends
 * `"currentPeriodEnd": null` for an account with no period (verified against the seeded Free and
 * Premium users). Both spellings must land on the same rendering, so the helper accepts null and
 * casts once here rather than letting the production type pretend the value cannot arrive.
 */
type SubscriptionPayload = { [K in keyof SubscriptionResponse]?: SubscriptionResponse[K] | null };

const sub = (over: SubscriptionPayload): SubscriptionResponse => ({ ...over }) as SubscriptionResponse;

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

  // An installed build outlives the enum it was compiled against, so both maps must degrade to
  // the raw value rather than to `undefined` — a blank plan line is indistinguishable from a
  // failed request. See CLAUDE.md §1.5.
  it("falls back to the raw value for a plan or status it predates", () => {
    const s = describeSubscription({
      plan: "PLATINUM",
      status: "PAUSED",
    } as unknown as Parameters<typeof describeSubscription>[0]);
    expect(s.plan).toBe("PLATINUM");
    expect(s.status).toBe("PAUSED");
  });

  // A TRIAL with no end date is missing information, not an ended trial. Asserting it has ended
  // tells an active trial user their access is gone.
  it("does not claim a trial ended when no end date was sent", () => {
    const s = describeSubscription({
      plan: "PREMIUM",
      status: "TRIAL",
    } as unknown as Parameters<typeof describeSubscription>[0]);
    expect(s.detail).toBe("");
    expect(s.tone).toBe("normal");
  });

  // A cancelled period that has already elapsed must not promise future access.
  it("puts a lapsed CANCELLED period in the past tense", () => {
    const now = new Date("2026-08-14T00:00:00+08:00");
    const past = describeSubscription(
      { plan: "PREMIUM", status: "CANCELLED", currentPeriodEnd: "2026-07-01T00:00:00+08:00" } as
        unknown as Parameters<typeof describeSubscription>[0],
      now,
    );
    expect(past.detail).toContain("ended");
    expect(past.tone).toBe("danger");

    const future = describeSubscription(
      { plan: "PREMIUM", status: "CANCELLED", currentPeriodEnd: "2026-09-01T00:00:00+08:00" } as
        unknown as Parameters<typeof describeSubscription>[0],
      now,
    );
    expect(future.detail).toContain("ends");
    expect(future.tone).toBe("warn");
  });

  // The three payloads below are verbatim `GET /subscription` responses from the local backend,
  // signed in as each seeded tier. Two details only show up against the real thing: the trial's
  // timestamp carries microseconds and an offset, and both Free and Premium seed with a null
  // period end — the case that reads as a bare badge.
  describe("against real backend payloads", () => {
    it("renders the seeded trial, microsecond timestamp and all", () => {
      const s = describeSubscription(
        sub({ plan: "TRIAL", status: "TRIAL", currentPeriodEnd: "2026-08-20T20:22:46.606429+08:00" }),
        new Date("2026-08-14T20:22:46+08:00"),
      );
      expect(s.plan).toBe("Trial");
      expect(s.detail).toBe("Trial ends Aug 20, 2026 · 6 days left");
      expect(s.tone).toBe("warn");
    });

    it("renders the seeded free and premium accounts as a plan and a badge", () => {
      const free = describeSubscription(
        sub({ plan: "FREE", status: "ACTIVE", currentPeriodEnd: null, billingPeriod: null }),
      );
      expect([free.plan, free.status, free.detail]).toEqual(["Free", "Active", ""]);

      const premium = describeSubscription(
        sub({ plan: "PREMIUM", status: "ACTIVE", currentPeriodEnd: null, billingPeriod: null }),
      );
      expect([premium.plan, premium.status, premium.detail]).toEqual(["Premium", "Active", ""]);
    });
  });

  it("says nothing extra when the backend sends no period end", () => {
    // What a seeded Free or manually granted Premium account really returns:
    // `{ plan, status: "ACTIVE", currentPeriodEnd: null, billingPeriod: null }`. "Active" under
    // an Active badge is noise, and a renewal date the backend never sent would be a fiction.
    expect(describeSubscription(sub({ plan: "PREMIUM", status: "ACTIVE" })).detail).toBe("");
    expect(describeSubscription(sub({ plan: "FREE", status: "ACTIVE" })).detail).toBe("");
  });
});
