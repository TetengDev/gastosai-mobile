import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { monthSummary } from "../../api/insights";
import { celebrationKey } from "../../lib/celebrateStore";
import { palettes } from "../../theme";
import { GoalsStrip, Hero, Insights, NeedsAttention, RecentList } from "./Home";

/**
 * Home's four sections and the collapsed Insights group (spec §4). The section logic is pinned in
 * `homeStatus.test.ts`; these pin what reaches the screen.
 */

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { email: "a@example.com" } }) }));
const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
}));
const seen = (event: string) => mockStore.get(celebrationKey("a@example.com", event));
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
  mockStore.clear();
  jest.mocked(Haptics.notificationAsync).mockClear();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

describe("Hero", () => {
  const props = {
    spent: 920000,
    sub: "spent this month",
    mood: "worried" as const,
    status: "Close to the limit · ₱800.00 left for 9 days",
    meter: { percent: 92, tone: "warning" as const, caption: "₱9,200.00 of ₱10,000.00 budgeted · 92%" },
    celebrations: [],
  };

  it("leads with the spend, Piso's mood, the meter and one status line", () => {
    wrap(<Hero {...props} />);
    expect(screen.getByText("₱9,200.00")).toBeOnTheScreen();
    expect(screen.getByText("spent this month")).toBeOnTheScreen();
    expect(screen.getByLabelText("Close to budget")).toBeOnTheScreen();
    expect(screen.getByLabelText("Month budget").props.accessibilityValue.now).toBe(92);
    expect(screen.getByText("₱9,200.00 of ₱10,000.00 budgeted · 92%")).toBeOnTheScreen();
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

  /**
   * TEN-505: every event used to mount at once, so a load with a closed month and two finished
   * goals played three coins and three haptics together. Event ids are fresh per test because
   * Celebrate's session claim outlives a render.
   */
  it("plays its celebrations one at a time, in order, with one haptic each", async () => {
    wrap(<Hero {...props} celebrations={["month-2026-09", "goal-21", "goal-22"]} />);
    await waitFor(() => expect(seen("month-2026-09")).toBe("1"));
    expect(seen("goal-21")).toBeUndefined();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);

    // Each holds 1.5 s before the next (web's CELEBRATION_HOLD_MS).
    await waitFor(() => expect(seen("goal-21")).toBe("1"), { timeout: 2500 });
    expect(seen("goal-22")).toBeUndefined();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);

    await waitFor(() => expect(seen("goal-22")).toBe("1"), { timeout: 2500 });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(3);
  }, 10000);

  it("skips an event already seen without replaying it or holding up the next", async () => {
    mockStore.set(celebrationKey("a@example.com", "month-2026-08"), "1");
    wrap(<Hero {...props} celebrations={["month-2026-08", "goal-31"]} />);
    // Well inside one play's length: a skip must not wait out a celebration that never ran.
    await waitFor(() => expect(seen("goal-31")).toBe("1"), { timeout: 300 });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("offers a way to set a budget when there is none", () => {
    wrap(<Hero {...props} mood="resting" meter={null} status="No budget set for this month." noBudget />);
    fireEvent.press(screen.getByText("Set a budget"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/budgets");
  });
});

describe("NeedsAttention", () => {
  it("is hidden when nothing needs attention", () => {
    wrap(<NeedsAttention rows={[]} />);
    expect(screen.queryByTestId("needs-attention")).toBeNull();
  });

  /** TEN-505: a failed bills query used to drop its bills without a word. */
  it("shows a bills error even when nothing else needs attention", () => {
    wrap(<NeedsAttention rows={[]} error="Could not reach the server." />);
    expect(screen.getByTestId("needs-attention")).toBeOnTheScreen();
    expect(screen.getByText("Could not reach the server.")).toBeOnTheScreen();
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

  /** TEN-540: a bill row the current month's mark covers says so, and marks it from Home. */
  it("gives a markable bill a Mark paid button, named for the bill, that does not navigate", () => {
    const onMarkPaid = jest.fn();
    wrap(
      <NeedsAttention
        rows={[
          {
            key: "o",
            label: "Meralco",
            sub: "Overdue · was due Nov 10",
            href: "/(app)/more/recurring",
            amount: 250000,
            markPaid: { id: 7 },
          },
        ]}
        onMarkPaid={onMarkPaid}
      />,
    );
    // Label in Name (WCAG 2.5.3): the spoken name starts with the visible "Mark paid".
    const button = screen.getByRole("button", { name: "Mark paid: Meralco" });
    expect(button).toHaveTextContent("Mark paid");
    // A 44pt target: the pill's text alone is well under it.
    expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44);
    fireEvent.press(button);
    expect(onMarkPaid).toHaveBeenCalledWith(7);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("gives a bill row without the mark no button", () => {
    wrap(
      <NeedsAttention
        rows={[{ key: "n", label: "Netflix", sub: "Due Dec 1", href: "/(app)/more/recurring", amount: 54900 }]}
        onMarkPaid={jest.fn()}
      />,
    );
    expect(screen.queryByText("Mark paid")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Mark paid/ })).toBeNull();
  });

  const overdueRow = {
    key: "o",
    label: "Meralco",
    sub: "Overdue · was due Nov 10",
    href: "/(app)/more/recurring" as const,
    amount: 250000,
    markPaid: { id: 7 },
    overdue: true,
  };

  it("says an overdue line in the warning amber, and an upcoming one in the quiet grey", () => {
    wrap(
      <NeedsAttention
        rows={[overdueRow, { key: "n", label: "Netflix", sub: "Due Nov 20", href: "/(app)/more/recurring", amount: 54900 }]}
      />,
    );
    expect(StyleSheet.flatten(screen.getByText("Overdue · was due Nov 10").props.style).color).toBe(palettes.light.warnText);
    expect(StyleSheet.flatten(screen.getByText("Due Nov 20").props.style).color).toBe(palettes.light.text2);
  });

  it("holds Mark paid, disabled and busy, while a mark is in flight", () => {
    const onMarkPaid = jest.fn();
    wrap(<NeedsAttention rows={[overdueRow]} onMarkPaid={onMarkPaid} busy />);
    const button = screen.getByRole("button", { name: "Mark paid: Meralco" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(button);
    expect(onMarkPaid).not.toHaveBeenCalled();
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

  it("names its link for where it goes, on screen and to a screen reader", () => {
    wrap(<GoalsStrip goals={[{ id: 7, name: "Trip fund", status: "ON_TRACK" }]} />);
    expect(screen.getByText("See all goals")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("See all goals"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/goals");
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

  it("shows the last five and a See all expenses link", () => {
    wrap(<RecentList expenses={expenses} loading={false} error={null} emptyText="" />);
    expect(screen.getByTestId("recent-row-4")).toBeOnTheScreen();
    expect(screen.queryByTestId("recent-row-5")).toBeNull();
    expect(screen.getByText("See all expenses")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("See all expenses"));
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
