import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AddExpense from "../../app/(app)/add-expense";
import { createExpense, listExpenses } from "../api/expenses";
import { budgetSummary } from "../api/budgets";
import type { BudgetSummaryItem, ExpenseRequest, ExpenseResponse } from "../api/types";
import { MonthProvider } from "../context/MonthContext";

/**
 * The Add expense route (spec §4, R18, R19, R23): saving holds the screen for 1.2 s with Piso
 * `saved` and the budget line where Save was, then returns to where the user came from.
 * Lives under `src/` because jest only matches there and expo-router treats `app/` as routes (R15).
 */

const mockOld: ExpenseResponse = {
  id: 1,
  amount: 9_000,
  category: "Food",
  description: "Coffee",
  date: "2026-11-17T08:00:00+08:00",
};

// The server's reply to the POST: its own category name, date and peso figure.
const mockSaved = (body: ExpenseRequest, date = "2026-11-18T12:00:00+08:00"): ExpenseResponse => ({
  id: 99,
  amount: body.amount,
  amountInBaseCurrency: body.amount,
  currency: "PHP",
  category: body.category,
  description: body.description,
  date,
});

// `remaining` disagrees with budgeted - spent, and each status with its sign: only the server's
// `remaining` may be read.
const food = (remaining: number): BudgetSummaryItem => ({
  categoryId: 1,
  categoryName: "Food",
  budgeted: 500_000,
  spent: 10_000,
  remaining,
  percentUsed: 97,
  status: remaining < 0 ? "ON_TRACK" : "OVER_BUDGET",
});
const summary = (items: BudgetSummaryItem[]) => async (month: string) => ({ month, items });

jest.mock("../api/expenses", () => ({
  listExpenses: jest.fn(async () => [mockOld]),
  listCategories: jest.fn(async () => [{ id: 1, name: "Food" }]),
  createExpense: jest.fn(async (body: ExpenseRequest) => mockSaved(body)),
}));
jest.mock("../api/budgets", () => ({ budgetSummary: jest.fn() }));

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

// Hidden tabs stay mounted. The stub runs the focus callback only while `mockFocused`, the way
// expo-router does for the screen the user is looking at.
let mockFocused = true;
let mockParams: Record<string, string> = {};
const mockNavigate = jest.fn();
// Each focus callback can be blurred and refocused, as expo-router does when the user leaves a
// hidden tab and comes back to it.
const mockFocusSetters = new Set<(focused: boolean) => void>();
jest.mock("expo-router", () => {
  const { useEffect, useState } = jest.requireActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ navigate: mockNavigate, replace: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => {
      const [focused, setFocused] = useState(mockFocused);
      useEffect(() => {
        mockFocusSetters.add(setFocused);
        return () => {
          mockFocusSetters.delete(setFocused);
        };
      }, []);
      useEffect(() => (focused ? effect() : undefined), [effect, focused]);
    },
  };
});

/** `cached`: keep queries fresh and in memory, as the app's own client does for 30 s. */
function renderAdd(cached = false) {
  const queries = cached ? { staleTime: Infinity, gcTime: Infinity } : { gcTime: 0 };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, ...queries } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MonthProvider>
        <AddExpense />
      </MonthProvider>
    </QueryClientProvider>,
  );
  return { client, view };
}

/** ₱250.00 in Food, once the history the first-expense check reads has landed. */
async function saveLunch(client: QueryClient) {
  await waitFor(() => expect(client.getQueryState(["expenses", "all"])?.status).toBe("success"));
  fireEvent.press(await screen.findByTestId("category-Food"));
  fireEvent.changeText(screen.getByTestId("expense-amount"), "250");
  fireEvent.changeText(screen.getByTestId("expense-description"), "Lunch");
  fireEvent.press(screen.getByText("Save"));
}

const hold = () => act(() => jest.advanceTimersByTimeAsync(1200));

/** Leaves the screen and comes back to it. */
const revisit = async () => {
  for (const focused of [false, true]) {
    await act(async () => {
      mockFocusSetters.forEach((set) => set(focused));
    });
  }
};
const hidden = { includeHiddenElements: true };

beforeEach(() => {
  jest.useFakeTimers();
  celebrated.length = 0;
  mockNavigate.mockClear();
  jest.mocked(budgetSummary).mockClear();
  jest.mocked(budgetSummary).mockImplementation(summary([food(175_000)]));
});
afterEach(() => {
  jest.useRealTimers();
});

describe("Add expense", () => {
  it("holds on Piso saved and what is left, then goes back", async () => {
    const { client } = renderAdd();
    await saveLunch(client);
    expect(await screen.findByText("Logged ₱250.00 · ₱1,750.00 left in Food")).toBeOnTheScreen();
    expect(screen.getByLabelText("Expense saved")).toBeOnTheScreen();
    expect(mockNavigate).not.toHaveBeenCalled();
    await hold();
    expect(mockNavigate).toHaveBeenCalledWith("/(app)");
    // The route stays mounted as a hidden tab; the next visit must not open on this line.
    expect(screen.queryByText(/^Logged/)).toBeNull();
  });

  // R18 is spec §2's 1.2 s, not merely "a while".
  it("holds for the full 1200 ms", async () => {
    const { client } = renderAdd();
    await saveLunch(client);
    await screen.findByText(/^Logged/);
    await act(() => jest.advanceTimersByTimeAsync(1100));
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTimeAsync(100));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // The app's client keeps queries fresh for 30 s; Home's summary for this month is usually in the
  // cache from before the save, and its `remaining` does not count the new expense.
  it("reads the summary from the server after the save, not from the cache", async () => {
    const { client } = renderAdd(true);
    client.setQueryData(["budgets", "summary", "2026-11"], { month: "2026-11", items: [food(200_000)] });
    await saveLunch(client);
    expect(await screen.findByText("Logged ₱250.00 · ₱1,750.00 left in Food")).toBeOnTheScreen();
  });

  // Home may be mid-fetch of this month's summary when Save is pressed; that answer predates the
  // expense and must not be the one the line reads.
  it("does not reuse a summary request that started before the save", async () => {
    const { client } = renderAdd(true);
    void client.prefetchQuery({
      queryKey: ["budgets", "summary", "2026-11"],
      queryFn: () =>
        new Promise((resolve) => setTimeout(() => resolve({ month: "2026-11", items: [food(200_000)] }), 1000)),
    });
    await saveLunch(client);
    expect(await screen.findByText("Logged ₱250.00 · ₱1,750.00 left in Food")).toBeOnTheScreen();
  });

  // Expenses' day totals and trend, Home's top and category cards, and every month's budget
  // summary all count the new expense; the monthly report is not the only stale one.
  it("marks every report and budget summary stale after the save", async () => {
    const { client } = renderAdd(true);
    const keys = [
      ["report", "monthly"],
      ["report", "daily", "2026-11"],
      ["report", "comparison", "2026-11"],
      ["report", "top", "2026-11"],
      ["report", "category"],
      ["budgets", "summary", "2026-10"],
    ];
    keys.forEach((key) => client.setQueryData(key, {}));
    await saveLunch(client);
    await screen.findByText(/^Logged/);
    for (const key of keys) expect([key, client.getQueryState(key)?.isInvalidated]).toEqual([key, true]);
  });

  // A slow summary must not hold the confirmation hostage: 1.5 s, then the amount alone.
  it("falls back to the amount alone when the summary takes over 1.5 s", async () => {
    jest.mocked(budgetSummary).mockImplementation(() => new Promise(() => {}));
    const { client } = renderAdd();
    await saveLunch(client);
    await act(() => jest.advanceTimersByTimeAsync(1400));
    expect(screen.queryByText(/^Logged/)).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(100));
    expect(screen.getByText("Logged ₱250.00")).toBeOnTheScreen();
    await hold();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("says how far over when the category is over budget", async () => {
    jest.mocked(budgetSummary).mockImplementation(summary([food(-5_000)]));
    const { client } = renderAdd();
    await saveLunch(client);
    expect(await screen.findByText("Logged ₱250.00 · Over by ₱50.00 in Food")).toBeOnTheScreen();
  });

  it("states the amount alone when the category has no budget", async () => {
    jest.mocked(budgetSummary).mockImplementation(summary([{ ...food(1), categoryName: "Transport" }]));
    const { client } = renderAdd();
    await saveLunch(client);
    expect(await screen.findByText("Logged ₱250.00")).toBeOnTheScreen();
  });

  it("states the amount alone when the summary fails", async () => {
    jest.mocked(budgetSummary).mockRejectedValue(new Error("boom"));
    const { client } = renderAdd();
    await saveLunch(client);
    expect(await screen.findByText("Logged ₱250.00")).toBeOnTheScreen();
  });

  // R19: the expense's month, read after the save.
  it("reads the budget of the month the server filed the expense in", async () => {
    jest.mocked(createExpense).mockImplementationOnce(async (body) => mockSaved(body, "2026-10-31T23:30:00+08:00"));
    const { client } = renderAdd();
    await saveLunch(client);
    await screen.findByText(/^Logged/);
    expect(jest.mocked(budgetSummary)).toHaveBeenLastCalledWith("2026-10");
  });

  it("takes the Save action away during the hold, so it cannot post twice", async () => {
    const { client } = renderAdd();
    await saveLunch(client);
    await screen.findByText(/^Logged/);
    expect(screen.queryByText("Save")).toBeNull();
  });

  // R23: an empty all-time list in hand at submit.
  it("celebrates the first expense ever", async () => {
    jest.mocked(listExpenses).mockResolvedValue([]);
    try {
      const { client } = renderAdd();
      await saveLunch(client);
      expect(await screen.findByTestId("celebrate-first-expense", hidden)).toBeTruthy();
    } finally {
      jest.mocked(listExpenses).mockResolvedValue([mockOld]);
    }
  });

  it("does not celebrate when an expense already exists", async () => {
    const { client } = renderAdd();
    await saveLunch(client);
    await screen.findByText(/^Logged/);
    expect(celebrated).toEqual([]);
  });

  // Not knowing is not the same as knowing it is empty.
  it("does not celebrate when the history had not loaded at submit", async () => {
    jest.mocked(listExpenses).mockImplementation(() => new Promise(() => {}));
    try {
      renderAdd();
      fireEvent.changeText(screen.getByTestId("expense-amount"), "250");
      fireEvent.changeText(screen.getByTestId("expense-description"), "Lunch");
      fireEvent.press(screen.getByText("Save"));
      await screen.findByText(/^Logged/);
      expect(celebrated).toEqual([]);
    } finally {
      jest.mocked(listExpenses).mockResolvedValue([mockOld]);
    }
  });

  it("still says it could not save, and stays", async () => {
    jest.mocked(createExpense).mockRejectedValueOnce(new Error("boom"));
    const { client } = renderAdd();
    await saveLunch(client);
    expect(await screen.findByText("Could not save the expense.")).toBeOnTheScreen();
    await hold();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Expense saved")).toBeNull();
  });

  // A save that lands while another tab is on screen shows nothing there and moves no one.
  it("neither holds, celebrates nor navigates while out of focus", async () => {
    jest.mocked(listExpenses).mockResolvedValue([]);
    mockFocused = false;
    try {
      const { client } = renderAdd();
      await saveLunch(client);
      await waitFor(() => expect(jest.mocked(budgetSummary)).toHaveBeenCalled());
      await hold();
      expect(screen.queryByText(/^Logged/)).toBeNull();
      expect(celebrated).toEqual([]);
      expect(mockNavigate).not.toHaveBeenCalled();
    } finally {
      mockFocused = true;
      jest.mocked(listExpenses).mockResolvedValue([mockOld]);
    }
  });

  // The route is a hidden tab that stays mounted; a return visit is a fresh form.
  it("comes back to an empty form with the amount focused again", async () => {
    renderAdd();
    const before = screen.getByTestId("expense-amount");
    fireEvent.changeText(before, "250");
    fireEvent.changeText(screen.getByTestId("expense-description"), "Lunch");
    await revisit();
    const after = screen.getByTestId("expense-amount");
    expect(after).not.toBe(before);
    expect(after.props.value).toBe("");
    expect(after.props.autoFocus).toBe(true);
    expect(screen.getByTestId("expense-description").props.value).toBe("");
  });

  // A second "Edit first" from quick-add hands new values to the same mounted route.
  it("takes the values handed to it on a later visit", async () => {
    mockParams = { amount: "100.00", description: "Taxi" };
    try {
      renderAdd();
      expect(screen.getByTestId("expense-amount").props.value).toBe("100.00");
      mockParams = { amount: "77.00", description: "Jollibee" };
      await revisit();
      expect(screen.getByTestId("expense-amount").props.value).toBe("77.00");
      expect(screen.getByTestId("expense-description").props.value).toBe("Jollibee");
    } finally {
      mockParams = {};
    }
  });

  // Leaving during the hold must not pull the user back 1.2 s later.
  it("does not navigate once the screen has gone", async () => {
    const { client, view } = renderAdd();
    await saveLunch(client);
    await screen.findByText(/^Logged/);
    view.unmount();
    await hold();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
