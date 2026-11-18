import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import ExpenseForm, { loggedLine } from "./ExpenseForm";
import { listExpenses } from "../api/expenses";
import type { BudgetSummaryItem, ExpenseResponse } from "../api/types";
import { palettes } from "../theme";

/** The shared add/edit form (spec §4): amount first, the six most recent categories, today's date. */

const expense = (id: number, category: string): ExpenseResponse => ({
  id,
  amount: 10_000,
  amountInBaseCurrency: 10_000,
  currency: "PHP",
  category,
  description: `row ${id}`,
  date: "2026-11-18T12:00:00+08:00",
});

// Newest first, as `GET /expenses` serves them. Food is also the most frequent, and Gifts the
// oldest: a count ranking would keep both and an eight-chip cap would keep Pets and Gifts.
const mockHistory = ["Food", "Transport", "Food", "Bills", "Fun", "Health", "Pets", "Gifts", "Gifts", "Gifts"].map(
  (c, i) => expense(i + 1, c),
);

jest.mock("../api/expenses", () => ({
  listExpenses: jest.fn(async () => mockHistory),
  listCategories: jest.fn(async () =>
    ["Bills", "Food", "Fun", "Gifts", "Groceries", "Health", "Pets", "Rent", "Transport"].map((name, id) => ({ id, name })),
  ),
}));

function renderForm(props: Partial<Parameters<typeof ExpenseForm>[0]> = {}) {
  const onSubmit = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <ExpenseForm submitLabel="Save" submitting={false} onSubmit={onSubmit} {...props} />
    </QueryClientProvider>,
  );
  return onSubmit;
}

const chipIds = () => screen.queryAllByTestId(/^category-/).map((n) => n.props.testID);
/** Where a testID first appears in the rendered tree, to compare reading order. */
const position = (id: string) => JSON.stringify(screen.toJSON()).indexOf(`"testID":"${id}"`);

afterEach(() => jest.useRealTimers());

describe("ExpenseForm", () => {
  // R20: recency, not frequency.
  it("offers the six most recently used categories, newest first", async () => {
    renderForm();
    await screen.findByTestId("category-Pets");
    expect(chipIds()).toEqual([
      "category-Food",
      "category-Transport",
      "category-Bills",
      "category-Fun",
      "category-Health",
      "category-Pets",
    ]);
  });

  // A first-time user has no history; the chips are still a tap away rather than gone.
  it("fills the chips from the category list when history has fewer than six", async () => {
    jest.mocked(listExpenses).mockResolvedValueOnce([expense(1, "Rent")]);
    renderForm();
    await screen.findByTestId("category-Rent");
    expect(chipIds()).toEqual([
      "category-Rent",
      "category-Bills",
      "category-Food",
      "category-Fun",
      "category-Gifts",
      "category-Groceries",
    ]);
  });

  // Pin: holds before TEN-446 and must keep holding.
  it("focuses the amount on open, ahead of the description", () => {
    renderForm();
    expect(screen.getByTestId("expense-amount").props.autoFocus).toBe(true);
    expect(position("expense-amount")).toBeLessThan(position("expense-description"));
  });

  // Spec §4: "category chips sit under it" — the amount, then the chips, then the words.
  it("puts the category chips straight under the amount", async () => {
    renderForm();
    await screen.findByTestId("category-Food");
    expect(position("expense-amount")).toBeLessThan(position("category-Food"));
    expect(position("category-Food")).toBeLessThan(position("expense-description"));
  });

  // Pin: "today's date" is the submit-time Manila clock, and an edit keeps its own date.
  it("dates a new expense now, in Manila wall-clock", () => {
    jest.useFakeTimers({ now: new Date("2026-11-18T03:04:05Z") });
    const onSubmit = renderForm();
    fireEvent.changeText(screen.getByTestId("expense-amount"), "250");
    fireEvent.changeText(screen.getByTestId("expense-description"), "Lunch");
    fireEvent.press(screen.getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 25_000, date: "2026-11-18T11:04:05" }));
  });

  it("keeps the date of an expense being edited", () => {
    const onSubmit = renderForm({ initial: { amount: "250.00", description: "Lunch", date: "2026-10-02T08:00:00" } });
    fireEvent.press(screen.getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-10-02T08:00:00" }));
  });

  // A peso has two decimal places; a third is refused, not rounded into a centavo never typed.
  it("refuses a third decimal place", () => {
    const onSubmit = renderForm();
    fireEvent.changeText(screen.getByTestId("expense-amount"), "25.00");
    fireEvent.changeText(screen.getByTestId("expense-amount"), "25.005");
    fireEvent.changeText(screen.getByTestId("expense-description"), "Lunch");
    fireEvent.press(screen.getByText("Save"));
    expect(screen.getByTestId("expense-amount").props.value).toBe("25.00");
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 2_500 }));
  });

  it("names every field for a screen reader", () => {
    renderForm();
    expect(screen.getByLabelText("Amount in pesos")).toBe(screen.getByTestId("expense-amount"));
    expect(screen.getByLabelText("Description")).toBe(screen.getByTestId("expense-description"));
    expect(screen.getByLabelText("Or type a new category")).toBe(screen.getByTestId("expense-category"));
  });

  // Same pair the TEN-448 review fixed on AmountSheet: text3 and link blue miss 4.5:1 in dark.
  it("draws the AMOUNT label in text2, and Done in textHi on a 44 pt target", () => {
    renderForm();
    expect(StyleSheet.flatten(screen.getByText("AMOUNT").props.style).color).toBe(palettes.light.text2);
    expect(StyleSheet.flatten(screen.getByText("Done").props.style).color).toBe(palettes.light.textHi);
    expect(StyleSheet.flatten(screen.getByTestId("amount-done").props.style)).toMatchObject({
      minHeight: 44,
      justifyContent: "center",
    });
  });

  it("shows what the screen hands it in place of the save action", () => {
    renderForm({ confirmation: <></> });
    expect(screen.queryByText("Save")).toBeNull();
  });
});

describe("loggedLine (R19)", () => {
  const saved = { ...expense(9, "Food"), amount: 25_000, amountInBaseCurrency: 25_000 };
  // `remaining` disagrees with budgeted - spent, and status with its sign: only the server's
  // `remaining` may be read, never re-derived.
  const food = (remaining: number): BudgetSummaryItem => ({
    categoryName: "Food",
    budgeted: 100_000,
    spent: 90_000,
    remaining,
    percentUsed: 12,
    status: remaining < 0 ? "ON_TRACK" : "OVER_BUDGET",
  });
  const other: BudgetSummaryItem = { categoryName: "Transport", remaining: 50_000, status: "ON_TRACK" };

  it("says what is left in the category's budget", () => {
    expect(loggedLine(saved, [other, food(175_000)])).toBe("Logged ₱250.00 · ₱1,750.00 left in Food");
  });

  it("says nothing is left at exactly zero", () => {
    expect(loggedLine(saved, [food(0)])).toBe("Logged ₱250.00 · ₱0.00 left in Food");
  });

  it("says how far over, in amber's words", () => {
    expect(loggedLine(saved, [food(-5_000)])).toBe("Logged ₱250.00 · Over by ₱50.00 in Food");
  });

  it("states the amount alone with no budget on the category, or no summary", () => {
    expect(loggedLine(saved, [other])).toBe("Logged ₱250.00");
    expect(loggedLine(saved, undefined)).toBe("Logged ₱250.00");
    expect(loggedLine({ ...saved, category: undefined }, [food(1)])).toBe("Logged ₱250.00");
  });

  it("reads the peso figure of a foreign-currency expense", () => {
    expect(loggedLine({ ...saved, amount: 150_000, amountInBaseCurrency: 57_750, currency: "JPY" }, undefined)).toBe(
      "Logged ₱577.50",
    );
  });
});
