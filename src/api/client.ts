import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { tokenStore } from "../lib/tokenStore";

/**
 * The only hand-written API transport in this repo.
 *
 * Everything typed flows through `src/api/generated/` (see CONTRACT.md) — this file owns base
 * URL, auth header injection and error surfacing, nothing else. No request or response type is
 * declared here.
 */

/** The port the backend listens on locally. Only used when no URL says otherwise. */
const DEFAULT_LOCAL_PORT = 8080;

/** Hosts that mean "this machine" — on a phone, that is the phone, never the laptop. */
const LOOPBACK = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i;

/** The same hosts, matched at the front of a URL. Anchored so `localhost.example.com` misses. */
const LOOPBACK_URL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(?=[:/]|$)/i;

function normalise(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * The address the Expo dev server is being served from — i.e. the laptop, as the device sees it.
 * Discovered at runtime from the packager connection, so it is never a value in the bundle.
 */
function expoLanHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return host && !LOOPBACK.test(host) ? host : null;
}

/** Swaps a loopback host for the Expo dev server's LAN address, keeping scheme, port and path. */
function toLanAddress(url: string): string {
  const lanHost = expoLanHost();
  if (!lanHost) return url;
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(?=[:/]|$)/i, `$1${lanHost}`);
}

/**
 * Where the API lives, and whether that is the developer's laptop.
 *
 * Three rules, in order:
 *
 * 1. **`EXPO_PUBLIC_API_URL_LOCAL` wins in development.** It is the local loop's opt-in: point it
 *    at the backend on your machine and `npm start` reaches it from a real phone. It is read only
 *    under `__DEV__`, so a release bundle ignores it even if the build machine had it set.
 * 2. **The LAN address is detected, never configured.** `localhost` is the *device* — a phone or
 *    an Android emulator cannot reach your laptop that way — so a loopback host is rewritten to
 *    the address Expo is already serving the bundle from. That is a runtime lookup; the IP is
 *    never inlined, which matters because it changes with every network you join and
 *    `EXPO_PUBLIC_*` is frozen into the bundle at build time.
 * 3. **A build uses `EXPO_PUBLIC_API_URL` verbatim.** No detection, no rewriting: outside `__DEV__`
 *    there is no dev server to ask, and quietly substituting a host in a shipped app would be a
 *    way to point it somewhere nobody chose.
 */
function resolveBaseUrl(): { url: string; local: boolean } {
  if (__DEV__) {
    const local = process.env.EXPO_PUBLIC_API_URL_LOCAL?.trim();
    if (local) return { url: normalise(toLanAddress(local)), local: true };

    const lanHost = expoLanHost();
    if (lanHost) return { url: `http://${lanHost}:${DEFAULT_LOCAL_PORT}`, local: true };
  }

  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    const swapped = __DEV__ ? toLanAddress(configured) : configured;
    // Only a host we actually substituted is known to be the laptop; a real remote URL is not.
    return { url: normalise(swapped), local: __DEV__ && swapped !== configured };
  }

  return { url: `http://localhost:${DEFAULT_LOCAL_PORT}`, local: false };
}

const resolved = resolveBaseUrl();

export const API_BASE_URL = resolved.url;

/** True when the base URL was resolved to the developer's own machine. Always false in a build. */
export const IS_LOCAL_BACKEND = resolved.local;

/**
 * The local backend that is really the phone.
 *
 * Only rule 1 can produce this: `EXPO_PUBLIC_API_URL_LOCAL=http://localhost:9090` is what someone
 * writes because it is what works on their laptop, and normally the loopback host is swapped for
 * the detected LAN address. In tunnel mode or over a USB-forwarded emulator there is no LAN
 * address to swap in, so the value survives verbatim and the app asks *itself* for the API.
 *
 * The generic local message is actively wrong here — the API is running and the network is fine;
 * the address is the problem — so this is worth telling apart. Rules 2 and 3 cannot reach it:
 * both only claim `local` for a host they resolved to a non-loopback LAN address.
 */
const RESOLVED_TO_DEVICE = IS_LOCAL_BACKEND && LOOPBACK_URL.test(API_BASE_URL);

// Which backend a dev session is actually talking to is otherwise invisible, and "the app does
// nothing" looks identical whether the URL is wrong or the server is down. Suppressed under jest,
// where every suite importing this module would otherwise print it.
if (__DEV__ && process.env.NODE_ENV !== "test") {
  console.log(`[api] base URL ${API_BASE_URL}${IS_LOCAL_BACKEND ? " (local)" : ""}`);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  // A laptop that is asleep, on another network, or not running the API does not refuse the
  // connection — it swallows it, and the default wait is long enough to read as a frozen screen.
  // Locally the round trip is a few milliseconds, so failing fast costs nothing real.
  timeout: IS_LOCAL_BACKEND ? 8_000 : 20_000,
});

/**
 * Which build is talking. Sent on every request.
 *
 * CONTRACT.md makes mobile the pacing constraint for breaking API changes: a `/api/v1` endpoint
 * cannot be retired until old installs have drained. Answering "have they?" requires the server
 * to have been told, and a shipped binary can never be retrofitted — so the clients that will
 * one day need counting must start reporting *before* they are in the wild, not after.
 */
export const APP_VERSION = Constants.expoConfig?.version ?? "unknown";
export const APP_PLATFORM = Platform.OS;

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-App-Version"] = APP_VERSION;
  config.headers["X-App-Platform"] = APP_PLATFORM;
  return config;
});

/**
 * Called when the server rejects the session. Set by the auth layer so this module does not
 * need to know about navigation — keeping the transport free of app wiring.
 */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      await tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** The RFC 7807 body the backend sends, plus the `feature` extension it sets on a plan gate. */
interface ProblemBody {
  detail?: string;
  title?: string;
  message?: string;
  /** A `FeatureKey` name — `NL_CHATBOT`, `ADVANCED_INSIGHTS`, … — present only on a plan gate. */
  feature?: string;
}

/**
 * Why a 402 happened. Two different things share the status and they need different answers.
 *
 * - `plan` — the account's subscription does not include the feature. Upgrading fixes it.
 * - `ai-key` — `/ai/**` runs through a bring-your-own-key interceptor which answers 402 when the
 *   account has no AI key of its own and shared-key fallback is off. **Upgrading does not fix
 *   this**, so it must never be offered here: selling someone a plan that leaves them exactly as
 *   stuck is worse than the generic error this issue set out to remove.
 */
export type PaywallKind = "plan" | "ai-key";

/**
 * The sentence every plan-gated message ends with.
 *
 * It does double duty. To the user it is the answer to "so what do I do?"; to `ErrorText` it is
 * how a paywall is told apart from an ordinary failure, since screens hand that component the
 * *string* and the error object never reaches it. Exact-suffix matching against a constant this
 * module owns, rather than pattern-sniffing prose — see `isPaywallMessage`.
 */
export const UPGRADE_PROMPT = "Upgrade to Premium to unlock it.";

/**
 * What each gated capability is called in the product.
 *
 * Wording only, in the same sense `formatCurrency` is — this decides nothing about entitlement,
 * which is the backend's alone (CLAUDE.md §1.2). The map exists because the server's default
 * message for the annotation-driven gate is `"This feature requires an upgraded plan: NL_CHATBOT"`,
 * and an enum name is not something to show a person.
 *
 * Every `FeatureKey` is listed, not just the ones mobile can reach today, because an installed
 * build meets server-side values it predates (CLAUDE.md §1.5) — and an unmapped key still degrades
 * to honest generic copy rather than to the enum.
 */
const FEATURE_LABELS: Record<string, string> = {
  AI_ANALYTICS: "Asking the assistant about your spending",
  NL_CHATBOT: "Ask AI",
  ADVANCED_INSIGHTS: "Spending insights",
  ANOMALY_DETECTION: "Unusual-spending alerts",
  BUDGET_FORECASTING: "Budget forecasting",
  TREND_ANALYSIS: "Trend analysis",
  CHAT_PERSONAS: "Assistant personas",
  CUSTOM_CATEGORIES: "Custom categories",
  UNLIMITED_TRANSACTIONS: "Unlimited expenses",
  EXPORT_CSV: "CSV export",
  EXPORT_PDF: "PDF export",
};

export interface Paywall {
  kind: PaywallKind;
  /** The raw `FeatureKey` the server named, or `null` when it named none. */
  feature: string | null;
  /** Ready to render. Plan gates always end in `UPGRADE_PROMPT`; an `ai-key` gate never does. */
  message: string;
}

/**
 * Reads a 402 as the thing it is, or returns `null` for anything else.
 *
 * The server sends two shapes of detail on a plan gate: a hand-written sentence carrying a real
 * fact ("Your plan is limited to 5 categories.") and a machine default that simply restates the
 * enum. The first is better than anything this file could write and is kept; the second is
 * detected by the only reliable tell it has — it contains the feature key verbatim — and replaced.
 */
export function paywall(error: unknown): Paywall | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 402) return null;

  const body = (error.response?.data ?? {}) as ProblemBody;
  const detail = body.detail ?? body.message;
  const feature = body.feature ?? null;

  // No feature key means this is not the plan gate. Today that is only the AI-key interceptor,
  // whose own wording is already specific and actionable, so it is passed through untouched.
  if (!feature) {
    if (detail) return { kind: "ai-key", feature: null, message: detail };
    return {
      kind: "ai-key",
      feature: null,
      message: "AI features are unavailable on this account right now.",
    };
  }

  const humanDetail = detail && !detail.includes(feature) ? detail : null;
  const label = FEATURE_LABELS[feature];
  const why = humanDetail ?? `${label ?? "This feature"} is not included in your plan.`;

  return { kind: "plan", feature, message: `${why} ${UPGRADE_PROMPT}` };
}

/** True for a message `paywall` minted for a plan gate — see `UPGRADE_PROMPT`. */
export const isPaywallMessage = (message?: string | null): boolean =>
  !!message && message.endsWith(UPGRADE_PROMPT);

/**
 * Turns an axios failure into something worth showing a user.
 *
 * A 402 is answered first and never falls through: it is not an unexpected error but a plan
 * boundary, and every screen in this app already renders whatever this function returns. Handling
 * it here rather than screen by screen is what makes the coverage complete — a gated endpoint
 * added tomorrow is explained without anyone remembering to wire it up.
 *
 * Otherwise the backend returns RFC 7807 problem details (`{title, detail, status}`), so prefer
 * `detail`; fall back to a network message rather than leaking an axios stack into the UI.
 *
 * When the base URL is the developer's own machine, "check your connection" sends them to look at
 * the wrong thing — their phone's wifi is fine and the laptop is what is missing. Naming the
 * address turns the two failures that actually happen (API not running, phone on the guest
 * network) into something readable off the screen.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  const gate = paywall(error);
  if (gate) return gate.message;

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ProblemBody | undefined;
    const fromBody = data?.detail ?? data?.message ?? data?.title;
    if (fromBody) return fromBody;
    if (!error.response) {
      if (RESOLVED_TO_DEVICE) {
        return `EXPO_PUBLIC_API_URL_LOCAL is ${API_BASE_URL}, which is this device, not your laptop. Expo is not serving over the LAN (tunnel mode or USB), so there was no address to substitute — set it to your laptop's LAN address in full.`;
      }
      return IS_LOCAL_BACKEND
        ? `Cannot reach the local backend at ${API_BASE_URL}. Check the API is running and that this device is on the same network.`
        : "Cannot reach the server. Check your connection.";
    }
  }
  return fallback;
}
