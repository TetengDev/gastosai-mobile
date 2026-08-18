import { describe, expect, it } from "@jest/globals";
import {
  centavosToAmount,
  describeSubscription,
  formatPrice,
  PERIOD_CADENCE,
  subscriptionChanged,
  timeRemaining,
  type PricingItem,
  type SubscriptionResponse,
} from "./subscription";

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

  // These lines used to end with "Renew on the web app", which stopped being true the moment this
  // screen grew a checkout — and the whole point of that checkout is not having to reach for a
  // laptop. Naming a route in copy is what went stale; the plan card's "View plans" affordance
  // carries the action now, and the same summary renders inside the sheet itself, where an
  // instruction to open the sheet would be nonsense.
  it("does not send a phone user to the web app to renew", () => {
    const lapsed: SubscriptionResponse[] = [
      sub({ plan: "PREMIUM", status: "EXPIRED", currentPeriodEnd: ENDS }),
      sub({ plan: "PREMIUM", status: "EXPIRED" }),
      sub({ plan: "TRIAL", status: "TRIAL", currentPeriodEnd: ENDS }),
      sub({ plan: "PREMIUM", status: "CANCELLED", currentPeriodEnd: ENDS }),
    ];
    for (const s of lapsed) {
      expect(describeSubscription(s, new Date("2026-10-01T00:00:00+08:00")).detail).not.toMatch(
        /web app/i,
      );
    }
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

/**
 * `/subscription/pricing` is the one endpoint that serves money as an int32 of centavos, so it is
 * the one place a conversion stands between the contract and the screen. `c / 100` would put a
 * float there, which CLAUDE.md §1.3 rules out — these tests exist to keep the string-slicing
 * implementation honest at the boundaries a division would quietly get wrong.
 */
describe("centavosToAmount", () => {
  // The two rows the local backend actually publishes, verbatim from
  // `GET /subscription/pricing`: ₱149.00 monthly and ₱1,290.00 annual.
  it("converts the published prices exactly", () => {
    expect(centavosToAmount(14900)).toBe("149.00");
    expect(centavosToAmount(129000)).toBe("1290.00");
  });

  // Under three digits there is no whole-peso part to slice, and a naive slice yields "" before
  // the point. Every one of these is a value the field can hold.
  it("pads a value with no whole-peso part", () => {
    expect(centavosToAmount(0)).toBe("0.00");
    expect(centavosToAmount(5)).toBe("0.05");
    expect(centavosToAmount(99)).toBe("0.99");
    expect(centavosToAmount(100)).toBe("1.00");
  });

  // Not a price, but the contract permits the sign and a mangled negative is worse than a right
  // one — a lost minus turns a credit into a charge.
  it("keeps the sign in front of a negative amount", () => {
    expect(centavosToAmount(-14900)).toBe("-149.00");
    expect(centavosToAmount(-5)).toBe("-0.05");
  });

  it("does not produce NaN for a value that is not a number", () => {
    expect(centavosToAmount(Number.NaN)).toBe("0.00");
    expect(centavosToAmount(Number.POSITIVE_INFINITY)).toBe("0.00");
  });

  // The largest int32 the field can carry, where a float would start losing centavos.
  it("stays exact at the top of the int32 range", () => {
    expect(centavosToAmount(2147483647)).toBe("21474836.47");
  });
});

describe("formatPrice", () => {
  const item = (over: Partial<PricingItem>): PricingItem =>
    ({ planKey: "PREMIUM", currency: "PHP", ...over }) as PricingItem;

  it("renders a published row as a peso amount", () => {
    expect(formatPrice(item({ period: "MONTHLY", amountCentavos: 14900 }))).toBe("₱149.00");
    expect(formatPrice(item({ period: "ANNUAL", amountCentavos: 129000 }))).toBe("₱1,290.00");
  });

  // Every field on `PricingItem` is optional, and the price is the one figure on the screen that
  // must never be invented. A dash says "we do not know"; "₱0.00" would say the plan is free.
  it("shows a dash rather than a price it was not sent", () => {
    expect(formatPrice(undefined)).toBe("—");
    expect(formatPrice(item({ period: "MONTHLY" }))).toBe("—");
  });
});

describe("PERIOD_CADENCE", () => {
  // The line under the price. Getting it the wrong way round misprices the plan by a factor of
  // twelve, and the toggle above it is the only other thing saying which period is selected.
  it("labels each period the way it is billed", () => {
    expect(PERIOD_CADENCE.MONTHLY).toBe("per month");
    expect(PERIOD_CADENCE.ANNUAL).toBe("per year");
  });
});

/**
 * How the app decides a checkout landed.
 *
 * Deliberately a diff against the pre-checkout snapshot rather than a test for "is this person
 * premium now" — reading `plan === "PREMIUM"` would be the device deciding an entitlement, which
 * is the backend's alone (CLAUDE.md §1.2). The tests below pin both halves of that: it must notice
 * every field moving, and it must stay silent when nothing did, because silence is what a
 * cancelled payment has to produce.
 */
describe("subscriptionChanged", () => {
  const free = sub({ plan: "FREE", status: "ACTIVE", currentPeriodEnd: null, billingPeriod: null });

  it("sees a free account become premium", () => {
    const premium = sub({
      plan: "PREMIUM",
      status: "ACTIVE",
      currentPeriodEnd: ENDS,
      billingPeriod: "ANNUAL",
    });
    expect(subscriptionChanged(free, premium)).toBe(true);
  });

  // A cancelled payment changes nothing, and the sheet's honest "nothing has changed yet" depends
  // entirely on this being false. Claiming an upgrade that did not happen is the expensive error.
  it("stays false when the backend says exactly what it said before", () => {
    expect(subscriptionChanged(free, sub({ ...free }))).toBe(false);
  });

  // Not every real change is an upgrade. A renewal moves only the period end; a switch from
  // monthly to annual moves only the billing period. Testing for "premium now" would miss both.
  it("notices a renewal or a period switch, not just an upgrade", () => {
    const monthly = sub({
      plan: "PREMIUM",
      status: "ACTIVE",
      currentPeriodEnd: "2026-09-12T00:30:00+08:00",
      billingPeriod: "MONTHLY",
    });
    expect(subscriptionChanged(monthly, sub({ ...monthly, currentPeriodEnd: "2026-10-12T00:30:00+08:00" }))).toBe(
      true,
    );
    expect(subscriptionChanged(monthly, sub({ ...monthly, billingPeriod: "ANNUAL" }))).toBe(true);
    expect(subscriptionChanged(monthly, sub({ ...monthly, status: "CANCELLED" }))).toBe(true);
  });

  // The first poll can land before the plan card's own query has ever resolved, so the "before"
  // snapshot may be missing. An unknown starting point is not evidence that anything moved.
  it("treats a missing answer as no news, in either direction", () => {
    expect(subscriptionChanged(undefined, undefined)).toBe(false);
    expect(subscriptionChanged(free, undefined)).toBe(false);
    // No snapshot but a real answer is the one case worth reporting: we now know something we
    // did not, and the sheet re-reads the authoritative response to say what it is.
    expect(subscriptionChanged(undefined, free)).toBe(true);
  });
});
