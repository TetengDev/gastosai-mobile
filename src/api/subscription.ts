import { api } from "./client";
import type { components } from "./generated/schema";
import { formatDateOnly } from "../lib/formatters";

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
  /** One plain line under the plan — renewal date, trial countdown, or the bad news. */
  detail: string;
  tone: SubscriptionTone;
}

/**
 * The whole rendered state of the screen, derived from the response and nothing else.
 *
 * Every branch below is a restatement of a field the backend sent, phrased for a person. An
 * expired subscription says so plainly rather than being softened into "inactive", because the
 * user's next action — go to the web app and renew — depends on knowing which one it is.
 */
export const describeSubscription = (
  sub: SubscriptionResponse | undefined,
  now: Date = new Date(),
): SubscriptionSummary => {
  const plan = sub?.plan ? PLAN_LABELS[sub.plan] : "—";
  const status = sub?.status ? STATUS_LABELS[sub.status] : "Unknown";
  const endsOn = sub?.currentPeriodEnd ? formatDateOnly(sub.currentPeriodEnd) : null;
  const left = timeRemaining(sub?.currentPeriodEnd, now);
  const billing = sub?.billingPeriod ? PERIOD_LABELS[sub.billingPeriod] : null;

  switch (sub?.status) {
    case "TRIAL":
      return {
        plan,
        status,
        detail: left
          ? `Trial ends ${endsOn} · ${left}`
          : "Your trial has ended. Renew on the web app to keep premium features.",
        tone: left ? "warn" : "danger",
      };

    case "ACTIVE":
      return {
        plan,
        status,
        // Two facts, both the backend's: when the period ends and how it is billed.
        detail: [endsOn ? `Renews ${endsOn}` : "Active", billing].filter(Boolean).join(" · "),
        tone: "normal",
      };

    case "CANCELLED":
      return {
        plan,
        status,
        // Cancelled is not expired. The period the user already paid for still has an end date,
        // and stating it is a restatement of `currentPeriodEnd`, not an entitlement decision.
        detail: endsOn ? `Cancelled · ends ${endsOn}` : "Cancelled.",
        tone: "warn",
      };

    case "EXPIRED":
      return {
        plan,
        status,
        detail: endsOn
          ? `Expired on ${endsOn}. Renew on the web app to keep premium features.`
          : "Expired. Renew on the web app to keep premium features.",
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
