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

/** `₱1,234.56`. The API serves decimal amounts at full precision; never do float math on them. */
export const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(num)) return "₱0.00";
  return `₱${num.toLocaleString(PESO_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
