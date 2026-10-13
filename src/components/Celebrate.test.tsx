import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AccessibilityInfo } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Celebrate } from "./Celebrate";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

describe("Celebrate", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.mocked(Haptics.notificationAsync).mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  it("cheers and buzzes once, then never again for the same event", async () => {
    const first = render(<Celebrate event="first-expense" />);
    expect(await screen.findByLabelText("Celebrating")).toBeOnTheScreen();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<Celebrate event="first-expense" />);
    await waitFor(() => expect(mockStore.get("ga.celebrate.first-expense")).toBe("1"));
    expect(screen.queryByLabelText("Celebrating")).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("does not spend the event when it unmounts before it could play", async () => {
    let resolveReduce: (v: boolean) => void = () => {};
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockReturnValueOnce(new Promise<boolean>((r) => (resolveReduce = r)));
    const early = render(<Celebrate event="first-budget" />);
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    early.unmount();
    resolveReduce(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockStore.get("ga.celebrate.first-budget")).toBeUndefined();

    render(<Celebrate event="first-budget" />);
    expect(await screen.findByLabelText("Celebrating")).toBeOnTheScreen();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("plays once when two mounts race for the same event", async () => {
    render(
      <>
        <Celebrate event="goal-1" />
        <Celebrate event="goal-1" />
      </>,
    );
    expect(await screen.findByLabelText("Celebrating")).toBeOnTheScreen();
    await waitFor(() => expect(mockStore.get("ga.celebrate.goal-1")).toBe("1"));
    expect(screen.getAllByLabelText("Celebrating")).toHaveLength(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("still cheers under reduced motion, without the coin", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    render(<Celebrate event="goal-3" />);
    expect(await screen.findByLabelText("Celebrating")).toBeOnTheScreen();
    expect(screen.queryByTestId("coin")).toBeNull();
  });
});
