/**
 * Display formatting. Ported from `gastosai-web/src/lib/formatters.ts` — the *approach* is
 * shared, not the package: polyrepo means no cross-repo runtime dependency.
 *
 * This is the only place money and dates are formatted.
 */

/**
 * The app's business timezone. The backend computes day and month rollups in Asia/Manila, so
 * every rendered timestamp must resolve in that zone — never the device's.
 *
 * This matters far more on mobile than on web. A browser user is almost always in PH; a phone
 * genuinely travels. Without pinning, `2026-06-26T01:00:00+08:00` renders as Jun 26 in Manila
 * but Jun 25 in New York — putting an expense in the wrong day and the wrong monthly total,
 * with nothing failing.
 */
export const APP_TIME_ZONE = "Asia/Manila";

const PESO_LOCALE = "en-PH";

/** How many centavos make a peso. The contract's v2 amounts are integers of this unit. */
export const CENTAVOS_PER_PESO = 100;

/**
 * `15075` -> `₱150.75`. The only way a contract v2 amount is rendered.
 *
 * The pesos and the centavos are split by integer division and joined as text, so no step ever
 * produces a fractional number: `amountCentavos / 100` would reintroduce exactly the binary
 * rounding the integer representation exists to remove.
 *
 * A non-integer input is rounded rather than trusted — the contract types these `int64`, so a
 * fraction here means something upstream already did float math and truncating would compound it.
 */
export const formatCentavos = (amountCentavos: number | null | undefined): string => {
  if (typeof amountCentavos !== "number" || !Number.isFinite(amountCentavos)) return "₱0.00";
  const cents = Math.round(amountCentavos);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const pesos = Math.trunc(abs / CENTAVOS_PER_PESO);
  const centavos = abs % CENTAVOS_PER_PESO;
  return `${sign}₱${pesos.toLocaleString(PESO_LOCALE)}.${String(centavos).padStart(2, "0")}`;
};

/**
 * `"150.75"` -> `15075`, and `null` for anything that is not an amount.
 *
 * Typed input is the other direction of the same rule. `parseFloat(x) * 100` is wrong for amounts
 * a user types every day — `"0.29"` scales to 28.999999999999996 and `"1.005"` to
 * 100.49999999999999 — and which literals survive is not visible by eye. So the peso and centavo
 * digits are read as text and joined, and nothing is ever multiplied.
 *
 * Accepts what a user actually types — `₱`, thousands separators, surrounding space, a leading
 * sign — and a third decimal place, which is rounded half-up away from zero. `null` rather than
 * `0` on failure: a rejected amount must be able to fail validation, not silently post as free.
 */
export const parseAmountToCentavos = (input: string | number | null | undefined): number | null => {
  if (input === null || input === undefined) return null;
  // A number argument is stringified rather than multiplied: `String(150.75)` is `"150.75"`,
  // so the float is left behind at the boundary instead of being scaled.
  const raw = (typeof input === "number" ? (Number.isFinite(input) ? String(input) : "") : input)
    .trim()
    .replace(/[₱\s]/g, "")
    .replace(/,/g, "");
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) return null;

  const [, sign, whole = "", fraction = ""] = match;
  if (!whole && !fraction) return null;

  // Two digits kept, the third consulted for rounding; a longer tail cannot change the result
  // once the third digit is known.
  const cents = (fraction + "00").slice(0, 2);
  const roundUp = Number(fraction[2] ?? "0") >= 5;
  const total = Number(`${whole || "0"}${cents}`) + (roundUp ? 1 : 0);
  if (!Number.isSafeInteger(total)) return null;
  return sign === "-" ? -total : total;
};

/** Full date and time, in the app's timezone. */
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return "-";
  return new Date(date).toLocaleString(PESO_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
};

/** Day and month only, in the app's timezone. For compact list rows. */
export const formatDayMonth = (date: string | null | undefined): string => {
  if (!date) return "-";
  return new Date(date).toLocaleString(PESO_LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
};

/** Calendar date only, in the app's timezone. */
export const formatDateOnly = (date: string | null | undefined): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString(PESO_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
};

/** `2026-07` -> `July 2026`. */
export const formatMonth = (month: string): string =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString(PESO_LOCALE, {
    month: "long",
    year: "numeric",
  });

/** The `YYYY-MM` the backend expects for month-scoped queries, in the app's timezone. */
export const currentMonth = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
};

/**
 * `2026-07` -> `{ from: "2026-07-01", to: "2026-07-31" }`, the inclusive bounds `GET /expenses`
 * takes.
 *
 * The last day is found by asking for day 0 of the *next* month, which is the last day of this
 * one — correct for 28/29/30/31 without a leap-year branch. Built with `Date.UTC` so the result
 * cannot shift by a day depending on where the phone is, which is the same trap `currentMonth`
 * avoids (§3 in CLAUDE.md).
 */
export const monthRange = (month: string): { from: string; to: string } => {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
};

/**
 * A timestamp the API will accept for a new expense, expressed as Manila wall-clock.
 *
 * The backend stores wall-clock Manila time and its deserializer accepts an offset-less value,
 * so sending the device's raw ISO string would silently record the wrong local time for anyone
 * outside PHT.
 */
export const nowForApi = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
};
