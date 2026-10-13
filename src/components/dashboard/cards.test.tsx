import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { BudgetOverviewCard, GoalProgressCard } from "./cards";

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
