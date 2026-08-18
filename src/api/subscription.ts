import { api } from "./client";
import type { components } from "./generated/schema";
import { formatCurrency, formatDateOnly } from "../lib/formatters";

/**
 * The user's subscription, as the backend sees it.
 *
 * `GET /subscription` is the single source of truth for what someone is paying for. Nothing here
 * decides a plan, compares tiers, grants access or gates a feature — the backend owns all of
 * that (CLAUDE.md §1.2), and mobile is the worst possible place to duplicate it: an installed
 * app keeps running its own copy of the rules for months after they change.
 *
 * What this module does own is the wording. Turning `{ plan: "PREMIUM", status: "ACTIVE",
 * currentPeriodEnd }` into "Premium · Renews 12 Sep 2026" is display formatting in the same
 * sense `formatCurrency` is, and it lives beside the fetch rather than in the screen so it can
 * be tested as a pure function.
 *
 * The type is aliased from the generated schema directly instead of via `src/api/types.ts`
 * because that file belongs to another issue's ownership; the shape is still the contract's, and
 * is never hand-declared here (CLAUDE.md §1.1).
 */
export type SubscriptionResponse = components["schemas"]["SubscriptionResponse"];
export type SubscriptionPlan = NonNullable<SubscriptionResponse["plan"]>;
export type SubscriptionStatus = NonNullable<SubscriptionResponse["status"]>;
export type BillingPeriod = NonNullable<SubscriptionResponse["billingPeriod"]>;

export const getSubscription = () =>
  api.get<SubscriptionResponse>("/subscription").then((r) => r.data);

export type PricingItem = components["schemas"]["PricingItem"];
export type CheckoutRequest = components["schemas"]["CheckoutRequest"];
export type CheckoutResponse = components["schemas"]["CheckoutResponse"];

/**
 * The published price list. Two rows today — premium monthly and premium annual — and the screen
 * renders whatever arrives rather than assuming that count.
 */
export const getPricing = () =>
  api.get<PricingItem[]>("/subscription/pricing").then((r) => r.data);

/**
 * Ask the backend to open a checkout session and hand back the provider's URL.
 *
 * The period is typed from `CheckoutRequest` rather than from `SubscriptionResponse`, even though
 * the two unions are identical today: this is the request's own field, and if the contract ever
 * widens one without the other, the build should break here rather than silently send a value the
 * endpoint rejects.
 */
export const startCheckout = (period: CheckoutRequest["period"]) =>
  api
    .post<CheckoutResponse>("/subscription/checkout", { period } satisfies CheckoutRequest)
    .then((r) => r.data);

/**
 * Integer centavos as an exact decimal string — `129000` -> `"1290.00"`.
 *
 * `/subscription/pricing` is the one endpoint that serves money as an int32 of centavos rather
 * than a decimal, so it needs a conversion the rest of the app does not. Doing it as `c / 100`
 * puts a float between the contract and the screen, which CLAUDE.md §1.3 rules out; string
 * slicing is exact for every value the field can hold. The result goes straight to
 * `formatCurrency`, so grouping and the peso sign stay in `formatters.ts` with every other amount.
 */
export const centavosToAmount = (centavos: number): string => {
  if (!Number.isFinite(centavos)) return "0.00";
  const whole = Math.trunc(centavos);
  const digits = String(Math.abs(whole)).padStart(3, "0");
  return `${whole < 0 ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
};

/** `₱1,290.00` for a price row, or a dash when the backend sent no amount. */
export const formatPrice = (item: PricingItem | undefined): string =>
  item?.amountCentavos === undefined ? "—" : formatCurrency(centavosToAmount(item.amountCentavos));

/** "per month" / "per year", for the line under the price. */
export const PERIOD_CADENCE: Record<BillingPeriod, string> = {
  MONTHLY: "per month",
  ANNUAL: "per year",
};

/**
 * Has the backend's view of the subscription moved since the snapshot taken before checkout?
 *
 * This is how the app decides a checkout landed, and it is deliberately a field-by-field diff
 * rather than a test for "is this person premium now". Reading `plan === "PREMIUM"` would be the
 * device deciding what someone is entitled to, which is the backend's alone (CLAUDE.md §1.2); a
 * diff only asks whether the authoritative answer changed, and stays correct for cases that are
 * not an upgrade at all — a renewal that only moves `currentPeriodEnd`, or a monthly plan
 * switching to annual.
 *
 * The consequence is the honest one: a cancelled payment changes nothing, so nothing is claimed.
 */
export const subscriptionChanged = (
  before: SubscriptionResponse | undefined,
  after: SubscriptionResponse | undefined,
): boolean =>
  !!after &&
  (before?.plan !== after.plan ||
    before?.status !== after.status ||
    before?.currentPeriodEnd !== after.currentPeriodEnd ||
    before?.billingPeriod !== after.billingPeriod);

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  TRIAL: "Trial",
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  TRIAL: "Trial",
  INACTIVE: "Inactive",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: "Billed monthly",
  ANNUAL: "Billed annually",
};

/**
 * How long is left before `currentPeriodEnd`, in the coarsest honest unit, or `null` once the
 * moment has passed.
 *
 * A duration, not a calendar difference: the answer to "how much trial is left" is the same
 * number of hours wherever the phone is, so this deliberately does no timezone arithmetic. The
 * *date* it ends on is a calendar fact and goes through `formatDateOnly`, which pins Manila.
 *
 * Hours below a day, because "1 day left" for something expiring in ninety minutes is the kind
 * of rounding a user only notices when it costs them.
 */
export const timeRemaining = (
  end: string | null | undefined,
  now: Date = new Date(),
): string | null => {
  if (!end) return null;
  const ms = new Date(end).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "less than an hour left";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} left`;
};

/** Drives colour only. `danger` means the user has lost access; `warn` means they are about to. */
export type SubscriptionTone = "normal" | "warn" | "danger";

export interface SubscriptionSummary {
  plan: string;
  status: string;
  /**
   * One plain line under the plan — renewal date, trial countdown, or the bad news.
   *
   * Empty when the backend sent nothing beyond plan and status, which is what a seeded Free or
   * manually granted Premium account actually looks like (`currentPeriodEnd: null`). The screen
   * drops the line rather than filling it: "Active" under an Active badge is noise, and
   * inventing a renewal that the backend did not describe is worse than saying nothing.
   */
  detail: string;
  tone: SubscriptionTone;
}

/**
 * The whole rendered state of the screen, derived from the response and nothing else.
 *
 * Every branch below is a restatement of a field the backend sent, phrased for a person. An
 * expired subscription says so plainly rather than being softened into "inactive": the two mean
 * different things to someone deciding whether to pay again, and softening one into the other
 * hides the decision.
 *
 * No branch tells the user where to renew. It used to say "on the web app", which was true until
 * this screen grew a checkout of its own — and a sentence that names a route goes stale the moment
 * the route moves. The affordance carries that job instead: the plan card renders "View plans"
 * directly under this line, and the same summary is reused *inside* the plans sheet, where telling
 * someone to open the sheet they are already looking at would be nonsense.
 */
export const describeSubscription = (
  sub: SubscriptionResponse | undefined,
  now: Date = new Date(),
): SubscriptionSummary => {
  // Fall back to the raw value, never `undefined`: this app's enums are the ones pinned at build
  // time, and installed builds meet server-side values they predate (CLAUDE.md §1.5). An unmapped
  // value renders as itself, which is worse than a label and far better than a blank line.
  const plan = sub?.plan ? PLAN_LABELS[sub.plan] ?? sub.plan : "—";
  const status = sub?.status ? STATUS_LABELS[sub.status] ?? sub.status : "Unknown";
  const endsOn = sub?.currentPeriodEnd ? formatDateOnly(sub.currentPeriodEnd) : null;
  const left = timeRemaining(sub?.currentPeriodEnd, now);
  const billing = sub?.billingPeriod ? PERIOD_LABELS[sub.billingPeriod] : null;

  switch (sub?.status) {
    case "TRIAL":
      return {
        plan,
        status,
        // Absent is not elapsed. Only claim the trial ended when the backend actually sent an end
        // date that has passed; with no date there is nothing to say beyond the badge, exactly as
        // the ACTIVE branch does. Telling an active trial it is over is the worse error.
        detail: left
          ? `Trial ends ${endsOn} · ${left}`
          : endsOn
            ? "Your trial has ended."
            : "",
        // No detail means nothing justifies a colour, so match the ACTIVE-with-no-dates case
        // rather than showing an amber dot with no sentence under it.
        tone: left ? "warn" : endsOn ? "danger" : "normal",
      };

    case "ACTIVE":
      return {
        plan,
        status,
        // Two facts, both the backend's: when the period ends and how it is billed. Either may
        // be absent, and then there is simply nothing more to say than the badge already says.
        detail: [endsOn ? `Renews ${endsOn}` : null, billing].filter(Boolean).join(" · "),
        tone: "normal",
      };

    case "CANCELLED":
      return {
        plan,
        status,
        // Cancelled is not expired. The period the user already paid for still has an end date,
        // and stating it is a restatement of `currentPeriodEnd`, not an entitlement decision.
        // Once that date is behind us the future tense becomes a false promise, so it moves to
        // the past tense and the harder colour — the same distinction EXPIRED makes.
        detail: endsOn
          ? left
            ? `Cancelled · ends ${endsOn}`
            : `Cancelled · ended ${endsOn}`
          : "Cancelled.",
        tone: !endsOn || left ? "warn" : "danger",
      };

    case "EXPIRED":
      return {
        plan,
        status,
        detail: endsOn ? `Expired on ${endsOn}.` : "Expired.",
        tone: "danger",
      };

    case "INACTIVE":
      return { plan, status, detail: "No active subscription.", tone: "normal" };

    default:
      // A response the pinned contract does not describe, or none at all. Say so rather than
      // guessing a plan — a wrong guess here is worse than an honest blank.
      return { plan, status, detail: "Plan details are unavailable right now.", tone: "normal" };
  }
};
