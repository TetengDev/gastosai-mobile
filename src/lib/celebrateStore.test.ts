import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
}));

import * as SecureStore from "expo-secure-store";
import { hasCelebrated, markCelebrated } from "./celebrateStore";

describe("celebrateStore", () => {
  beforeEach(() => mockStore.clear());

  it("is unseen until marked, then seen, under a SecureStore-legal key", async () => {
    expect(await hasCelebrated("goal-7")).toBe(false);
    await markCelebrated("goal-7");
    expect(await hasCelebrated("goal-7")).toBe(true);
    expect(mockStore.get("ga.celebrate.goal-7")).toBe("1");
  });

  it("reads as already seen when the store throws", async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("locked"));
    expect(await hasCelebrated("goal-7")).toBe(true);
  });

  it("does not reject when the store cannot be written", async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("locked"));
    await expect(markCelebrated("goal-7")).resolves.toBeUndefined();
  });
});
