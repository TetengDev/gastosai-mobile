import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import Budgets from "../../app/(app)/budgets";
import { MonthProvider } from "../context/MonthContext";
import { accents, palettes } from "../theme";

/**
 * The Budgets route (spec §4): one Piso in the header in the worst line's mood, rows fullest
 * first, and every row's dot, meter and text read from the server's band and figures.
 * Lives under `src/` because jest only matches there and expo-router treats `app/` as routes (R15).
 */

// Server order, deliberately not the display order: 30, 104, 84.
const items = [
  { categoryId: 1, categoryName: "Food", budgeted: 114_300, spent: 34_300, remaining: 80_000, percentUsed: 30, status: "ON_TRACK" },
  { categoryId: 2, categoryName: "Rent", budgeted: 3_000_000, spent: 3_120_000, remaining: -120_000, percentUsed: 104, status: "OVER_BUDGET" },
  { categoryId: 3, categoryName: "Fun", budgeted: 250_000, spent: 210_000, remaining: 40_000, percentUsed: 84, status: "WARNING" },
];

jest.mock("../api/budgets", () => ({
  budgetSummary: async (month: string) => ({
    month,
    safeToSpend: 0,
    dailyAllowance: 0,
    totalSpent: 3_364_300,
    totalBudgeted: 3_364_300,
    items,
  }),
  listBudgets: async () => [],
  createBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn(),
}));
jest.mock("../api/categories", () => ({ listCategories: async () => [] }));

function renderBudgets() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MonthProvider>
        <Budgets />
      </MonthProvider>
    </QueryClientProvider>,
  );
}

/** The colour of the status dot drawn beside a pill's label. */
function pillDotColor(label: string): unknown {
  type Node = ReturnType<typeof screen.getByText>;
  for (let node: Node | null = screen.getByText(label); node; node = node.parent) {
    for (const child of node.children) {
      if (typeof child === "string") continue;
      const style = StyleSheet.flatten(child.props.style);
      if (style?.width === 7 && style?.height === 7) return style.backgroundColor;
    }
  }
  throw new Error(`no dot beside ${label}`);
}

describe("Budgets", () => {
  it("lists the lines fullest first", async () => {
    renderBudgets();
    await screen.findByText("Rent");
    expect(screen.getAllByText(/^\d+%$/).map((n) => n.props.children)).toEqual(["104%", "84%", "30%"]);
  });

  it("takes each pill dot from the server's band, amber for over budget", async () => {
    renderBudgets();
    await screen.findByText("Rent");
    expect(pillDotColor("104%")).toBe(palettes.light.warnText);
    expect(pillDotColor("84%")).toBe(palettes.light.warnText);
    expect(pillDotColor("30%")).toBe(accents.brand);
  });

  it("says what is left, or how far over", async () => {
    renderBudgets();
    expect(await screen.findByText("₱800.00 left")).toBeOnTheScreen();
    expect(screen.getByText("Over by ₱1,200.00")).toBeOnTheScreen();
  });

  it("puts one Piso in the header, in the worst line's mood, beside the month stepper", async () => {
    renderBudgets();
    await screen.findByText("Rent");
    expect(screen.getAllByLabelText("Over budget")).toHaveLength(1);
    expect(screen.getByTestId("month-label")).toBeOnTheScreen();
  });
});
