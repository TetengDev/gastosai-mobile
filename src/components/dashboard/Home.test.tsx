import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { monthSummary } from "../../api/insights";
import { GoalsStrip, Hero, Insights, NeedsAttention, RecentList } from "./Home";

/**
 * Home's four sections and the collapsed Insights group (spec §4). The section logic is pinned in
 * `homeStatus.test.ts`; these pin what reaches the screen.
 */

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { email: "a@example.com" } }) }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("../../api/insights", () => ({
  monthSummary: jest.fn(async () => ({ month: "2026-09", summary: "You spent less than August." })),
  topCategoryInsight: jest.fn(async () => null),
}));
jest.mock("../../api/expenses", () => ({ dailyReport: async () => [] }));
jest.mock("../../api/reports", () => ({
  monthlyComparison: async () => null,
  topExpenses: async () => [{ id: 1, description: "Groceries", amount: 190000, category: "Food" }],
  categoryReport: async () => [{ category: "Food", total: 190000 }],
}));

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  mockPush.mockClear();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

describe("Hero", () => {
  const props = {
    spent: 920000,
    sub: "spent this month",
    mood: "worried" as const,
    status: "Close to the limit · ₱800.00 left for 9 days",
    meter: { percent: 92, tone: "warning" as const, caption: "₱9,200.00 of ₱10,000.00 budget" },
    celebrations: [],
  };

  it("leads with the spend, Piso's mood, the meter and one status line", () => {
    wrap(<Hero {...props} />);
    expect(screen.getByText("₱9,200.00")).toBeOnTheScreen();
    expect(screen.getByText("spent this month")).toBeOnTheScreen();
    expect(screen.getByLabelText("Close to budget")).toBeOnTheScreen();
    expect(screen.getByLabelText("Month budget").props.accessibilityValue.now).toBe(92);
    expect(screen.getByText("₱9,200.00 of ₱10,000.00 budget")).toBeOnTheScreen();
    expect(screen.getByTestId("home-status")).toHaveTextContent(props.status);
  });

  it("drops the meter when there is no budget", () => {
    wrap(<Hero {...props} meter={null} />);
    expect(screen.queryByLabelText("Month budget")).toBeNull();
  });

  it("mounts Celebrate over Piso for each event it is given", async () => {
    wrap(<Hero {...props} celebrations={["goal-7"]} />);
    // Hidden from screen readers on purpose — the mood Piso under it already speaks.
    expect(await screen.findByTestId("coin", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe("NeedsAttention", () => {
  it("is hidden when nothing needs attention", () => {
    wrap(<NeedsAttention rows={[]} />);
    expect(screen.queryByTestId("needs-attention")).toBeNull();
  });

  it("shows a budget's meter and a bill's amount, each linking to its tab", () => {
    wrap(
      <NeedsAttention
        rows={[
          { key: "b", label: "Food", sub: "Over by ₱30.00", href: "/(app)/budgets", tone: "over", percent: 130 },
          { key: "n", label: "Netflix", sub: "Due Oct 23", href: "/(app)/more/recurring", amount: 54900 },
        ]}
      />,
    );
    expect(screen.getByLabelText("Food budget").props.accessibilityValue.now).toBe(130);
    expect(screen.getByText("₱549.00")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Netflix"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/more/recurring");
  });
});

describe("GoalsStrip", () => {
  it("is hidden without goals", () => {
    wrap(<GoalsStrip goals={[]} />);
    expect(screen.queryByTestId("card-goals")).toBeNull();
  });

  it("draws one goal-toned meter per goal", () => {
    wrap(
      <GoalsStrip
        goals={[{ id: 7, name: "Trip fund", savedAmount: 9000, targetAmount: 10000, progressPercent: 90, status: "ON_TRACK" }]}
      />,
    );
    expect(screen.getByLabelText("Trip fund").props.accessibilityValue.now).toBe(90);
    expect(screen.getByText("₱90.00 of ₱100.00")).toBeOnTheScreen();
  });
});

describe("RecentList", () => {
  const expenses = Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    description: `Row ${i}`,
    amount: 10000,
    category: "Food",
    date: "2026-10-20T10:00:00+08:00",
  }));

  it("shows the last five and a See all link", () => {
    wrap(<RecentList expenses={expenses} loading={false} error={null} emptyText="" />);
    expect(screen.getByTestId("recent-row-4")).toBeOnTheScreen();
    expect(screen.queryByTestId("recent-row-5")).toBeNull();
    fireEvent.press(screen.getByText("See all"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/expenses");
  });

  it("renders the base-currency figure, not the foreign amount", () => {
    wrap(
      <RecentList
        expenses={[{ id: 1, description: "Ramen", amount: 150000, amountInBaseCurrency: 57750, currency: "JPY" }]}
        loading={false}
        error={null}
        emptyText=""
      />,
    );
    expect(screen.getByText("₱577.50")).toBeOnTheScreen();
  });
});

describe("Insights", () => {
  it("is collapsed by default and asks the AI nothing until opened", async () => {
    wrap(<Insights month="2026-09" />);
    const toggle = screen.getByTestId("insights-toggle");
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByTestId("card-top")).toBeNull();
    expect(monthSummary).not.toHaveBeenCalled();

    fireEvent.press(toggle);
    expect(await screen.findByText("You spent less than August.")).toBeOnTheScreen();
    expect(await screen.findByTestId("card-top")).toBeOnTheScreen();
    expect(await screen.findByTestId("card-categories")).toBeOnTheScreen();
  });
});
