import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AxiosError, type AxiosResponse } from "axios";
import QuickAdd from "../../app/(app)/quick-add";
import { createExpense, listExpenses } from "../api/expenses";
import { budgetSummary } from "../api/budgets";
import { scanReceipt } from "../api/ai";
import type { ExpenseRequest, ExpenseResponse } from "../api/types";
import { MonthProvider } from "../context/MonthContext";

/**
 * The Quick add route (spec §4, R18, R19, R23): typed entry first, receipt scan as the secondary
 * path, and the same 1.2 s hold on Piso `saved` and the budget line once "Save this" lands.
 * Lives under `src/` because jest only matches there and expo-router treats `app/` as routes (R15).
 */

const mockOld: ExpenseResponse = { id: 1, amount: 9_000, category: "Food", date: "2026-11-17T08:00:00+08:00" };

jest.mock("../api/expenses", () => ({
  listExpenses: jest.fn(async () => [mockOld]),
  parseExpense: jest.fn(async () => ({
    amount: 25_000,
    description: "Lunch at Jollibee",
    category: "Food",
    date: "2026-11-18T12:00:00",
    confidence: "HIGH",
    saveable: true,
  })),
  createExpense: jest.fn(
    async (body: ExpenseRequest): Promise<ExpenseResponse> => ({
      id: 99,
      amount: body.amount,
      amountInBaseCurrency: body.amount,
      currency: "PHP",
      category: body.category,
      description: body.description,
      date: "2026-11-18T12:00:00+08:00",
    }),
  ),
}));
// Status contradicts the sign of `remaining`; only `remaining` may be read.
jest.mock("../api/budgets", () => ({
  budgetSummary: jest.fn(async (month: string) => ({
    month,
    items: [{ categoryName: "Food", budgeted: 500_000, spent: 10_000, remaining: 175_000, percentUsed: 97, status: "OVER_BUDGET" }],
  })),
}));
jest.mock("../api/ai", () => ({ scanReceipt: jest.fn() }));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: "file:///receipt.jpg", mimeType: "image/jpeg" }] }),
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: "file:///receipt.jpg", mimeType: "image/jpeg" }] }),
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

const mockNavigate = jest.fn();
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ navigate: mockNavigate, replace: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

function renderQuickAdd() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MonthProvider>
        <QuickAdd />
      </MonthProvider>
    </QueryClientProvider>,
  );
  return client;
}

/** The all-time history R23 reads at submit. */
const historyLoaded = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryState(["expenses", "all"])?.status).toBe("success"));

/** Types a sentence, reads it, and saves the proposal. */
async function readAndSave() {
  fireEvent.changeText(screen.getByTestId("quick-add-input"), "lunch 250 at Jollibee");
  fireEvent.press(screen.getByText("Read it"));
  fireEvent.press(await screen.findByText("Save this"));
}

const hold = () => act(() => jest.advanceTimersByTimeAsync(1200));
/** Where a testID first appears in the rendered tree, to compare reading order. */
const position = (id: string) => JSON.stringify(screen.toJSON()).indexOf(`"testID":"${id}"`);

beforeEach(() => {
  jest.useFakeTimers();
  celebrated.length = 0;
  mockNavigate.mockClear();
  jest.mocked(createExpense).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("Quick add", () => {
  it("holds on Piso saved and what is left, then goes back", async () => {
    renderQuickAdd();
    await readAndSave();
    expect(await screen.findByText("Logged ₱250.00 · ₱1,750.00 left in Food")).toBeOnTheScreen();
    expect(screen.getByLabelText("Expense saved")).toBeOnTheScreen();
    expect(jest.mocked(budgetSummary)).toHaveBeenLastCalledWith("2026-11");
    expect(mockNavigate).not.toHaveBeenCalled();
    await hold();
    expect(mockNavigate).toHaveBeenCalledWith("/(app)");
    expect(screen.queryByText(/^Logged/)).toBeNull();
  });

  it("takes Save this and Edit first away during the hold", async () => {
    renderQuickAdd();
    await readAndSave();
    await screen.findByText(/^Logged/);
    expect(screen.queryByText("Save this")).toBeNull();
    expect(screen.queryByText("Edit first")).toBeNull();
    expect(jest.mocked(createExpense)).toHaveBeenCalledTimes(1);
  });

  // The + button opens this screen, so it is where a first expense usually comes from (R23).
  it("celebrates the first expense ever", async () => {
    jest.mocked(listExpenses).mockResolvedValue([]);
    try {
      await historyLoaded(renderQuickAdd());
      await readAndSave();
      expect(await screen.findByTestId("celebrate-first-expense", { includeHiddenElements: true })).toBeTruthy();
    } finally {
      jest.mocked(listExpenses).mockResolvedValue([mockOld]);
    }
  });

  it("does not celebrate when an expense already exists", async () => {
    await historyLoaded(renderQuickAdd());
    await readAndSave();
    await screen.findByText(/^Logged/);
    expect(celebrated).toEqual([]);
  });

  it("still says it could not save, and stays", async () => {
    jest.mocked(createExpense).mockRejectedValueOnce(new Error("boom"));
    renderQuickAdd();
    await readAndSave();
    expect(await screen.findByText("Could not save the expense.")).toBeOnTheScreen();
    await hold();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Expense saved")).toBeNull();
  });

  // Pin: receipt scan stays, as the second path under the typed one.
  it("keeps receipt scan below the typed entry", () => {
    renderQuickAdd();
    expect(position("quick-add-input")).toBeLessThan(position("scan-receipt"));
    expect(position("scan-receipt")).toBeLessThan(position("choose-photo"));
  });

  // Pin: a busy vision provider is an expected outcome with a way forward, not a failure.
  it("offers manual entry when receipt reading is over its limit", async () => {
    jest.mocked(scanReceipt).mockRejectedValueOnce(
      new AxiosError("busy", "ERR_BAD_REQUEST", undefined, undefined, { status: 429 } as AxiosResponse),
    );
    renderQuickAdd();
    fireEvent.press(screen.getByTestId("scan-receipt"));
    expect(
      await screen.findByText("AI limit reached for now. You can still add the expense manually."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Add manually instead")).toBeOnTheScreen();
  });
});
