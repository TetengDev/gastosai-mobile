import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { monthSummary, topCategoryInsight } from "../../api/insights";
import { BudgetOverviewCard, GoalProgressCard } from "./cards";
import InsightCard from "./InsightCard";

/**
 * The dashboard's two meter cards after the `ProgressBar` retirement (TEN-437): each row's meter
 * takes its tone from the server's status and carries its true figure, never a clamped one.
 * Only the two network-touching calls are mocked.
 */

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../api/budgets", () => ({
  budgetSummary: async () => ({
    items: [
      { categoryId: 1, categoryName: "Food", spent: 13000, budgeted: 10000, percentUsed: 130, status: "OVER_BUDGET" },
      { categoryId: 2, categoryName: "Rent", spent: 9000, budgeted: 10000, percentUsed: 90, status: "WARNING" },
    ],
  }),
}));
jest.mock("../../api/goals", () => ({
  listGoals: async () => [
    { id: 7, name: "Trip fund", savedAmount: 12000, targetAmount: 10000, progressPercent: 120, status: "COMPLETED" },
  ],
}));
jest.mock("../../api/insights", () => ({
  monthSummary: jest.fn(),
  topCategoryInsight: jest.fn(),
}));

const mockSummary = monthSummary as jest.MockedFunction<typeof monthSummary>;
const mockTop = topCategoryInsight as jest.MockedFunction<typeof topCategoryInsight>;

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("BudgetOverviewCard", () => {
  it("names each meter after its category and reports the true percent", async () => {
    wrap(<BudgetOverviewCard month="2026-10" />);
    const food = await screen.findByLabelText("Food budget");
    expect(food.props.accessibilityRole).toBe("progressbar");
    expect(food.props.accessibilityValue).toEqual({ min: 0, max: 130, now: 130, text: "130%" });
    expect(screen.getByLabelText("Rent budget").props.accessibilityValue.now).toBe(90);
  });

  it("draws the overflow share only for the over-budget line", async () => {
    wrap(<BudgetOverviewCard month="2026-10" />);
    await screen.findByLabelText("Food budget");
    expect(screen.getAllByTestId("meter-overflow")).toHaveLength(1);
  });
});

describe("GoalProgressCard", () => {
  it("never draws a goal past 100 as overflow", async () => {
    wrap(<GoalProgressCard />);
    const trip = await screen.findByLabelText("Trip fund");
    expect(trip.props.accessibilityValue.now).toBe(120);
    expect(screen.queryByTestId("meter-overflow")).toBeNull();
  });
});

/**
 * TEN-461: `/ai/**` shares one 20-per-minute window per user, so `top-category` can answer 429 —
 * or fail outright — while the month summary beside it succeeded. The sentence must survive that,
 * and the category line must vanish rather than print `undefined` or the backend's "None".
 */
describe("InsightCard", () => {
  const SUMMARY = { month: "2026-09", summary: "You spent 51.83% less than August." };

  it("names the server's top category with its total and share", async () => {
    mockSummary.mockResolvedValue(SUMMARY);
    mockTop.mockResolvedValue({ month: "2026-09", category: "Meal Plan", total: 403500, percentOfMonthTotal: 40.18 });
    wrap(<InsightCard month="2026-09" />);
    expect(await screen.findByText(/Biggest category: Meal Plan · ₱4,035\.00 · 40% of the month/)).toBeTruthy();
  });

  it("keeps the sentence and drops the category line when top-category fails", async () => {
    mockSummary.mockResolvedValue(SUMMARY);
    mockTop.mockRejectedValue(new Error("Request failed with status code 500"));
    wrap(<InsightCard month="2026-09" />);
    await screen.findByText(SUMMARY.summary);
    expect(screen.queryByText(/Biggest category/)).toBeNull();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("drops the category line when top-category is rate limited", async () => {
    mockSummary.mockResolvedValue(SUMMARY);
    mockTop.mockResolvedValue(null);
    wrap(<InsightCard month="2026-09" />);
    await screen.findByText(SUMMARY.summary);
    expect(screen.queryByText(/Biggest category/)).toBeNull();
  });

  it("drops the category line for a body without a category", async () => {
    mockSummary.mockResolvedValue(SUMMARY);
    mockTop.mockResolvedValue({ month: "2026-09" });
    wrap(<InsightCard month="2026-09" />);
    await screen.findByText(SUMMARY.summary);
    expect(screen.queryByText(/Biggest category/)).toBeNull();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("does not name the backend's 'None' placeholder for a month with no spending", async () => {
    mockSummary.mockResolvedValue(SUMMARY);
    mockTop.mockResolvedValue({ month: "2026-03", category: "None", total: 0, percentOfMonthTotal: 0 });
    wrap(<InsightCard month="2026-03" />);
    await screen.findByText(SUMMARY.summary);
    expect(screen.queryByText(/Biggest category/)).toBeNull();
  });
});
