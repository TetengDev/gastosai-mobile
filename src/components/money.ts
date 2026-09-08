import { formatCentavos } from "../lib/formatters";

/**
 * The centavo edge between the `/api/v2` contract and the screens.
 *
 * `src/lib/formatters.ts` owns the two primitives — `formatCentavos` renders an integer, and
 * `parseAmountToCentavos` reads what a user types back into one. This module is the thin layer
 * above them that the components need and that neither primitive covers: pre-filling an editable
 * amount field, and picking which of an expense's two amounts to show.
 *
 * Nothing here divides, multiplies or otherwise arithmetic on an amount. Every value is derived
 * from `formatCentavos`, which splits pesos and centavos by integer division and joins them as
 * text — so a centavo cannot be lost between the API and the screen (CLAUDE.md §1.3).
 */

/**
 * `15075` -> `"150.75"`: the text an amount field opens with when editing an existing amount.
 *
 * Rendered by `formatCentavos` and stripped of the peso sign and thousands separators, because a
 * `decimal-pad` field has to hold something the user can edit and `parseAmountToCentavos` can read
 * back. `c / 100` would be the obvious way to write this and is exactly the float round-trip the
 * integer representation exists to remove.
 *
 * An absent amount gives `""` — an empty field, not `"0.00"`, which the user would have to clear
 * before typing.
 */
export const centavosToInput = (centavos: number | null | undefined): string =>
  centavos == null ? "" : formatCentavos(centavos).replace(/[₱,]/g, "");

/**
 * A money field of an untyped payload as centavos.
 *
 * Only for the assistant's `result`, which the contract types as `{}` — every other amount in the
 * app arrives through a generated type and needs no coercion. `Number` is exact here because the
 * value is a JSON integer: v2 puts centavos on the wire, so there is no fraction to lose. A value
 * that is not a finite number reads as `0` rather than rendering `₱NaN`.
 */
export const centavosOf = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The peso figure to show for an expense, and the original amount when it was not in pesos.
 *
 * The centavo-side successor to the decimal-era helper `formatters.ts` used to export (deleted in
 * TEN-355), and it keeps that helper's rule: `amount` is in the expense's *own* currency, so a
 * ¥1,500 meal must not be rendered with a peso sign while the day total beside it reads the
 * server-converted figure. The backend has already converted; this only picks the right field and
 * hands both to `formatCentavos`.
 *
 * Falling back to `amount` covers rows the API returns without a base figure, which are PHP by
 * definition.
 */
export const expenseAmountText = (e: {
  amount?: number;
  amountInBaseCurrency?: number;
  currency?: string;
}): { base: string; original: string | null } => {
  const isForeign = !!e.currency && e.currency !== "PHP";
  return {
    base: formatCentavos(e.amountInBaseCurrency ?? e.amount ?? 0),
    // The peso sign is dropped rather than kept: the figure is in `currency`, which is named
    // after it.
    original: isForeign ? `${formatCentavos(e.amount ?? 0).replace("₱", "")} ${e.currency}` : null,
  };
};
