import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { RefreshControl } from "react-native";
import Home from "../../app/(app)/index";
import { api } from "../api/client";
import { listRecurring } from "../api/recurring";
import type { RecurringExpenseResponse } from "../api/types";
import { MonthProvider } from "../context/MonthContext";

/**
 * The Home route: Mark paid from Needs attention (TEN-540), and celebrations held to the moments
 * the tab is on screen. Row logic is pinned in `homeStatus.test.ts`; this pins the wiring — the
 * request, the refetch, the failure, and focus.
 * Lives under `src/` because jest only matches there and expo-router treats `app/` as routes (R15).
 */

const meralco = (paidThisMonth: boolean): RecurringExpenseResponse => ({
  id: 7,
  name: "Meralco",
  paidThisMonth,
  lastPaidMonth: paidThisMonth ? "2026-11" : "2026-10",
});

jest.mock("../api/budgets", () => ({
  budgetSummary: jest.fn(async (month: string) => ({ month, totalSpent: 0, totalBudgeted: 0, percentUsed: 0, items: [] })),
}));
jest.mock("../api/expenses", () => ({
  listExpenses: jest.fn(async () => []),
  monthlyReport: jest.fn(async () => [{ month: "2026-11", total: 500_000 }]),
}));
jest.mock("../api/goals", () => ({
  listGoals: jest.fn(async () => [{ id: 2, name: "Japan trip", status: "COMPLETED" }]),
}));
// The list and the upcoming answers are stubbed; `markRecurringPaid` is the real one, so the
// request it sends is what the tests see on `api.put`.
jest.mock("../api/recurring", () => ({
  ...jest.requireActual<typeof import("../api/recurring")>("../api/recurring"),
  listRecurring: jest.fn(),
  upcomingBills: jest.fn(async (month: string) =>
    month === "2026-11"
      ? [
          { id: 7, name: "Meralco", dueDate: "2026-11-10", amount: 250_000 },
          { id: 8, name: "Netflix", dueDate: "2026-11-20", amount: 54_900 },
        ]
      : [],
  ),
}));

const celebrated: string[] = [];
jest.mock("../components/Celebrate", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Celebrate: ({ event }: { event: string }) => {
      celebrated.push(event);
      return <Text testID={`celebrate-${event}`} />;
    },
  };
});

// Tabs stay mounted when hidden. The stub runs the focus callback only while `mockFocused`, the
// way expo-router does for a tab the user is looking at.
let mockFocused = true;
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => (mockFocused ? effect() : undefined), [effect]);
    },
  };
});

const put = jest.spyOn(api, "put");

beforeEach(() => {
  // Nov 18, 04:00 in Manila; still Nov 17 in UTC and in New York, where jest runs. Only `Date` is
  // faked, so react-query and the finders keep their real timers.
  jest.useFakeTimers({
    now: new Date("2026-11-17T20:00:00Z"),
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
  mockFocused = true;
  mockPush.mockClear();
  celebrated.length = 0;
  put.mockReset();
  jest.mocked(listRecurring).mockReset().mockResolvedValue([meralco(false)]);
});

afterEach(() => {
  jest.useRealTimers();
});

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MonthProvider>
        <Home />
      </MonthProvider>
    </QueryClientProvider>,
  );
}

describe("Home, Mark paid", () => {
  it("marks this month paid, once however often it is pressed, and drops the row on the refetch", async () => {
    let resolve: () => void = () => undefined;
    put.mockImplementation(() => new Promise((r) => (resolve = () => r({ data: undefined }))));
    renderHome();
    expect(await screen.findByText("Overdue · was due Nov 10")).toBeOnTheScreen();

    const button = screen.getByRole("button", { name: "Mark paid: Meralco" });
    fireEvent.press(button);
    fireEvent.press(button);
    // The mutation starts a tick later; the second tap landed before it did.
    await waitFor(() => expect(put).toHaveBeenCalledWith("/recurring/7/payments/2026-11"));
    expect(put).toHaveBeenCalledTimes(1);

    jest.mocked(listRecurring).mockResolvedValue([meralco(true)]);
    await act(async () => resolve());
    await waitFor(() => expect(screen.queryByText("Meralco")).toBeNull());
    expect(screen.queryByText("Could not mark that bill paid. Try again.")).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  /** Fix round 1: the pull-to-refresh spinner is the user's pull, not Mark paid's refetch. */
  it("leaves the pull-to-refresh spinner off while Mark paid refetches, and on while the user pulls", async () => {
    put.mockResolvedValue({ data: undefined });
    renderHome();
    fireEvent.press(await screen.findByRole("button", { name: "Mark paid: Meralco" }));
    let answer: (list: RecurringExpenseResponse[]) => void = () => undefined;
    jest.mocked(listRecurring).mockImplementation(() => new Promise((r) => (answer = r)));
    await waitFor(() => expect(listRecurring).toHaveBeenCalledTimes(2));
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
    await act(async () => answer([meralco(true)]));

    jest.mocked(listRecurring).mockImplementation(() => new Promise((r) => (answer = r)));
    await act(async () => screen.UNSAFE_getByType(RefreshControl).props.onRefresh());
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
    await act(async () => answer([meralco(true)]));
    await waitFor(() => expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false));
  });

  it("says so in Needs attention when the mark fails, keeps the row, and lets it be tried again", async () => {
    put.mockRejectedValue(new Error("boom"));
    renderHome();
    fireEvent.press(await screen.findByRole("button", { name: "Mark paid: Meralco" }));
    expect(await screen.findByText("Could not mark that bill paid. Try again.")).toBeOnTheScreen();
    expect(screen.getByText("Overdue · was due Nov 10")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "Mark paid: Meralco" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  });

  it("does not carry a failed mark's error onto a past month, where there is nothing to retry", async () => {
    put.mockRejectedValue(new Error("boom"));
    renderHome();
    fireEvent.press(await screen.findByRole("button", { name: "Mark paid: Meralco" }));
    expect(await screen.findByText("Could not mark that bill paid. Try again.")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("month-prev"));
    await waitFor(() => expect(screen.queryByText("Overdue · was due Nov 10")).toBeNull());
    expect(screen.queryByText("Could not mark that bill paid. Try again.")).toBeNull();
  });

  it("holds the bill rows until the paid state lands, so a paid bill never flashes up as due", async () => {
    let answer: (list: RecurringExpenseResponse[]) => void = () => undefined;
    jest.mocked(listRecurring).mockImplementation(() => new Promise((r) => (answer = r)));
    renderHome();
    await screen.findByTestId("home-status");
    expect(screen.queryByText("Netflix")).toBeNull();
    expect(screen.queryByText("Meralco")).toBeNull();

    await act(async () => answer([meralco(false)]));
    expect(await screen.findByText("Netflix")).toBeOnTheScreen();
    expect(screen.getByText("Overdue · was due Nov 10")).toBeOnTheScreen();
  });

  it("lists the upcoming bills as before, without a word, when /recurring fails (R2)", async () => {
    jest.mocked(listRecurring).mockRejectedValue(new Error("boom"));
    renderHome();
    expect(await screen.findByText("Netflix")).toBeOnTheScreen();
    expect(screen.queryByText("Meralco")).toBeNull();
    expect(screen.queryByText("Mark paid")).toBeNull();
    expect(screen.queryByText("boom")).toBeNull();
  });
});

describe("Home, celebrations", () => {
  it("holds a celebration while the tab is hidden, so it is not spent unseen", async () => {
    mockFocused = false;
    renderHome();
    await screen.findByText("Netflix");
    expect(celebrated).toEqual([]);
  });

  it("plays it while the tab is on screen", async () => {
    renderHome();
    // Hidden from screen readers by Hero on purpose, so it is found among hidden elements.
    expect(await screen.findByTestId("celebrate-goal-2", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
