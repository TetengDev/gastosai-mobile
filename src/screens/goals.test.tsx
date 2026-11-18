import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Goals from "../../app/(app)/goals";
import { listGoals, updateGoal } from "../api/goals";
import { Piso } from "../brand/Piso";
import type { GoalResponse } from "../api/types";
import { formatDateOnly } from "../lib/formatters";

/**
 * The Goals route (spec §4): one card per goal with its meter, date and "Add savings", and a
 * finished goal celebrated once, then folded into a collapsed Achieved group.
 * Lives under `src/` because jest only matches there and expo-router treats `app/` as routes (R15).
 */

// Status and percentage disagree both ways, so only the server's status can sort these: Japan trip
// is COMPLETED at 96%, Emergency fund is still ON_TRACK at 100%. Server order puts the completed
// goal first, so an index taken over the whole list would hand it `goal-menu-0`.
const completed: GoalResponse = {
  id: 2,
  name: "Japan trip",
  savedAmount: 960_000,
  targetAmount: 1_000_000,
  progressPercent: 96,
  status: "COMPLETED",
  targetDate: "2026-12-15",
};
const atHundred: GoalResponse = {
  id: 1,
  name: "Emergency fund",
  savedAmount: 5_000_000,
  targetAmount: 5_000_000,
  progressPercent: 100,
  status: "ON_TRACK",
  targetDate: "2027-03-31",
};
const behind: GoalResponse = {
  id: 3,
  name: "Laptop",
  savedAmount: 2_000_000,
  targetAmount: 5_000_000,
  progressPercent: 40,
  status: "BEHIND",
  targetDate: "2027-06-30",
};

jest.mock("../api/goals", () => ({
  listGoals: jest.fn(async () => [completed, atHundred, behind]),
  createGoal: jest.fn(),
  updateGoal: jest.fn(async () => ({})),
  deleteGoal: jest.fn(),
}));

// Celebrate reads the signed-in account and a secure-store flag; the screen's job is only to mount
// it with the right event, which the stub records.
// The stub's onPress stands in for "played and held", which is when the real one calls onDone.
const celebrated: string[] = [];
jest.mock("../components/Celebrate", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Celebrate: ({ event, onDone }: { event: string; onDone?: () => void }) => {
      celebrated.push(event);
      return <Text testID={`celebrate-${event}`} onPress={onDone} />;
    },
  };
});

// Tabs stay mounted when hidden. The stub runs the focus callback only while `mockFocused`, the
// way expo-router does for a tab the user is looking at.
let mockFocused = true;
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => (mockFocused ? effect() : undefined), [effect]);
    },
  };
});

function renderGoals() {
  celebrated.length = 0;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <Goals />
    </QueryClientProvider>,
  );
}

const achievedToggle = () => screen.getByRole("button", { name: /^Achieved/ });

describe("Goals", () => {
  // Pin: holds before TEN-448 and must keep holding.
  it("gives an active goal a meter, its target date and Add savings", async () => {
    renderGoals();
    expect(await screen.findByLabelText("Laptop", { exact: true })).toBeOnTheScreen();
    expect(screen.getByLabelText("Laptop").props.accessibilityRole).toBe("progressbar");
    expect(screen.getByText(`by ${formatDateOnly("2027-06-30")}`)).toBeOnTheScreen();
    expect(screen.getByTestId("goal-contribute-3")).toBeOnTheScreen();
  });

  it("keeps a goal the server has not completed in the list, even at 100%", async () => {
    renderGoals();
    expect(await screen.findByText("Emergency fund")).toBeOnTheScreen();
    expect(screen.getByTestId("goal-contribute-1")).toBeOnTheScreen();
  });

  it("folds a completed goal into a collapsed Achieved group", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    expect(screen.queryByText("Japan trip")).toBeNull();
    // Named by its label, not its text content: the chevron beside it is not read out.
    expect(screen.getByRole("button", { name: "Achieved (1)" })).toBeOnTheScreen();
    expect(achievedToggle().props.accessibilityState).toMatchObject({ expanded: false });

    fireEvent.press(achievedToggle());
    expect(screen.getByText("Japan trip")).toBeOnTheScreen();
    expect(achievedToggle().props.accessibilityState).toMatchObject({ expanded: true });
  });

  it("gives a completed goal no Add savings", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    fireEvent.press(achievedToggle());
    expect(screen.getByText("Japan trip")).toBeOnTheScreen();
    expect(screen.queryByTestId("goal-contribute-2")).toBeNull();
  });

  it("shows no Achieved group when nothing is completed", async () => {
    jest.mocked(listGoals).mockResolvedValueOnce([atHundred, behind]);
    renderGoals();
    await screen.findByText("Laptop");
    expect(screen.queryByRole("button", { name: /^Achieved/ })).toBeNull();
  });

  it("celebrates the completed goal, and only that one", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    expect(new Set(celebrated)).toEqual(new Set(["goal-2"]));
  });

  // Spec §4: a reached goal "shows cheer once, then folds away", and two never play at once.
  it("plays one celebration at a time, and folds each away once it has played", async () => {
    jest.mocked(listGoals).mockResolvedValueOnce([completed, { ...behind, status: "COMPLETED" }]);
    renderGoals();
    // Hidden from screen readers and untouchable on purpose (the Achieved group says it in text),
    // so the stub's onDone is called directly rather than pressed.
    const hidden = { includeHiddenElements: true };
    const finish = (id: string) => act(() => screen.getByTestId(id, hidden).props.onPress());
    await screen.findByTestId("celebrate-goal-2", hidden);
    expect(screen.queryByTestId("celebrate-goal-3", hidden)).toBeNull();
    finish("celebrate-goal-2");
    expect(screen.queryByTestId("celebrate-goal-2", hidden)).toBeNull();
    finish("celebrate-goal-3");
    expect(screen.queryByTestId(/^celebrate-/, hidden)).toBeNull();
  });

  // A hidden tab must not spend the once-only cheer where nobody sees it.
  it("does not celebrate while the Goals tab is not in focus", async () => {
    mockFocused = false;
    try {
      renderGoals();
      await screen.findByText("Laptop");
      expect(celebrated).toEqual([]);
    } finally {
      mockFocused = true;
    }
  });

  // `.maestro/goals.yaml` and the demo cleanup tap `goal-menu-0` for the goal they just created.
  it("indexes goal-menu over the active goals only", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    expect(screen.getByTestId("goal-menu-0")).toHaveProp("accessibilityLabel", "Actions for Emergency fund");
    expect(screen.getByTestId("goal-menu-1")).toHaveProp("accessibilityLabel", "Actions for Laptop");
  });

  it("puts one Piso in the header once the goals have loaded", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    expect(screen.UNSAFE_queryAllByType(Piso)).toHaveLength(1);
  });

  // Until the list lands there is nothing to be in a mood about; a Piso beside a skeleton or an
  // error would read calm and then change.
  it("draws no Piso while the goals are loading", () => {
    jest.mocked(listGoals).mockImplementationOnce(() => new Promise(() => {}));
    renderGoals();
    expect(screen.UNSAFE_queryAllByType(Piso)).toHaveLength(0);
  });

  it("draws no Piso when the goals fail to load", async () => {
    jest.mocked(listGoals).mockRejectedValueOnce(new Error("boom"));
    renderGoals();
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
    expect(screen.UNSAFE_queryAllByType(Piso)).toHaveLength(0);
  });

  // A failed pull-to-refresh keeps the cached goals, but the screen is now saying "Could not load":
  // a calm Piso beside that would contradict it.
  it("draws no Piso when a refresh fails", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    jest.mocked(listGoals).mockRejectedValueOnce(new Error("boom"));
    await act(() => screen.getByTestId("goals-screen").props.refreshControl.props.onRefresh());
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
    expect(screen.UNSAFE_queryAllByType(Piso)).toHaveLength(0);
  });

  // Controller ruling (fix round 1): "Add savings" is the amount to add, on both platforms.
  it("asks Add savings for the amount to add, in a sheet with no name field", async () => {
    renderGoals();
    fireEvent.press(await screen.findByTestId("goal-contribute-3"));
    expect(screen.getAllByText("Add savings").length).toBeGreaterThan(1);
    expect(screen.getByTestId("sheet-amount").props.value).toBe("");
    expect(screen.queryByTestId("sheet-label")).toBeNull();
  });

  it("adds what was entered to the saved total, in centavos", async () => {
    renderGoals();
    fireEvent.press(await screen.findByTestId("goal-contribute-3"));
    fireEvent.changeText(screen.getByTestId("sheet-amount"), "500");
    fireEvent.press(screen.getByTestId("sheet-save"));
    await act(async () => {});
    expect(jest.mocked(updateGoal).mock.lastCall).toEqual([
      3,
      expect.objectContaining({ savedAmount: 2_050_000, name: "Laptop", targetAmount: 5_000_000 }),
    ]);
  });

  // The sheet can sit open across a refresh; adding to the figure it opened with would drop
  // whatever another device saved in between.
  it("adds to the saved total as it stands at submit, not as it was when the sheet opened", async () => {
    renderGoals();
    fireEvent.press(await screen.findByTestId("goal-contribute-3"));
    jest.mocked(listGoals).mockResolvedValueOnce([completed, atHundred, { ...behind, savedAmount: 2_100_000 }]);
    await act(() => screen.getByTestId("goals-screen").props.refreshControl.props.onRefresh());
    // The query publishes the refetched list a tick later; the open sheet hides the cards.
    await screen.findByText(/₱21,000\.00 of/, { includeHiddenElements: true });
    fireEvent.changeText(screen.getByTestId("sheet-amount"), "500");
    fireEvent.press(screen.getByTestId("sheet-save"));
    await act(async () => {});
    expect(jest.mocked(updateGoal).mock.lastCall?.[1]).toMatchObject({ savedAmount: 2_150_000 });
  });

  it("lets a completed goal still be edited or deleted", async () => {
    renderGoals();
    await screen.findByText("Laptop");
    fireEvent.press(achievedToggle());
    // Its own testID family, so `goal-menu-N` stays the active list's.
    expect(screen.getByLabelText("Actions for Japan trip")).toHaveProp("testID", "goal-achieved-menu-0");
  });
});
