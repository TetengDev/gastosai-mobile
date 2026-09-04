import { describe, expect, it } from "@jest/globals";
import { parseAmountToCentavos } from "../lib/formatters";
import { centavosOf, centavosToInput, expenseAmountText } from "./money";

/**
 * The centavo edge, from both directions.
 *
 * The failure these guard against is silent: every amount is a `number` either way, so sending
 * pesos where the v2 contract wants centavos type-checks perfectly and is wrong by a factor of a
 * hundred. Nothing here may divide or multiply — a passing round-trip on "150.75" and a failing
 * one on "0.29" is exactly what `parseFloat(x) * 100` produces.
 */

describe("centavosToInput", () => {
  it("renders an amount as the text a user would have typed", () => {
    expect(centavosToInput(15075)).toBe("150.75");
    expect(centavosToInput(15000)).toBe("150.00");
    expect(centavosToInput(7)).toBe("0.07");
  });

  // Grouping is for reading, not for editing: "1,234.56" in a decimal-pad field is text the user
  // cannot reproduce by typing.
  it("drops the peso sign and the thousands separators", () => {
    expect(centavosToInput(123456)).toBe("1234.56");
    expect(centavosToInput(100000000)).toBe("1000000.00");
  });

  it("keeps a negative sign", () => {
    expect(centavosToInput(-15075)).toBe("-150.75");
  });

  // An empty field, not "0.00" — a pre-filled zero is something the user has to clear before
  // typing, and a form that opens with a value it was not given is lying about what it holds.
  it("gives an empty field when there is no amount", () => {
    expect(centavosToInput(null)).toBe("");
    expect(centavosToInput(undefined)).toBe("");
  });

  // The property that matters: what comes out of the API and back into it is the same integer.
  // This is the whole point of the issue — the phone and the web agreeing to the centavo.
  it("round-trips through parseAmountToCentavos", () => {
    for (const cents of [0, 1, 29, 99, 100, 101, 15075, 123456, 99999999]) {
      expect(parseAmountToCentavos(centavosToInput(cents))).toBe(cents);
    }
  });
});

describe("centavosOf", () => {
  it("passes an integer through", () => {
    expect(centavosOf(15075)).toBe(15075);
    expect(centavosOf(0)).toBe(0);
  });

  // The assistant's `result` is typed `{}` in the contract, so a number can arrive as a string.
  it("reads a numeric string", () => {
    expect(centavosOf("15075")).toBe(15075);
  });

  // "₱NaN" on a chat bubble is worse than a zero: it looks like the app broke rather than like
  // the answer had no amount.
  it("reads anything else as zero", () => {
    expect(centavosOf(undefined)).toBe(0);
    expect(centavosOf(null)).toBe(0);
    expect(centavosOf("lunch")).toBe(0);
  });
});

describe("expenseAmountText", () => {
  // The bug this rule exists for: `amount` is in the expense's own currency, so a ¥1,500 meal
  // rendered with a peso sign disagreed on screen with the server-converted day total.
  it("shows the converted figure and names the original currency", () => {
    const { base, original } = expenseAmountText({
      amount: 150000,
      amountInBaseCurrency: 57750,
      currency: "JPY",
    });

    expect(base).toBe("₱577.50");
    expect(original).toBe("1,500.00 JPY");
  });

  it("shows no original for a peso expense", () => {
    const { base, original } = expenseAmountText({
      amount: 17700,
      amountInBaseCurrency: 17700,
      currency: "PHP",
    });

    expect(base).toBe("₱177.00");
    expect(original).toBeNull();
  });

  // Rows the API returns without a base figure are PHP by definition.
  it("falls back to amount when there is no base figure", () => {
    expect(expenseAmountText({ amount: 9000 }).base).toBe("₱90.00");
    expect(expenseAmountText({}).base).toBe("₱0.00");
  });
});
