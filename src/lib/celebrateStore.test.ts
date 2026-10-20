import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as SecureStore from "expo-secure-store";
import { celebrationKey, hasCelebrated, markCelebrated } from "./celebrateStore";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
}));

describe("celebrateStore", () => {
  beforeEach(() => mockStore.clear());

  it("is unseen until marked, then seen, under a SecureStore-legal key", async () => {
    expect(await hasCelebrated("a@example.com", "goal-7")).toBe(false);
    await markCelebrated("a@example.com", "goal-7");
    expect(await hasCelebrated("a@example.com", "goal-7")).toBe(true);
    expect([...mockStore.keys()]).toEqual([celebrationKey("a@example.com", "goal-7")]);
    expect(await hasCelebrated("b@example.com", "goal-7")).toBe(false);
  });

  it("keys by an opaque, SecureStore-legal account hash, not the email", () => {
    const key = celebrationKey("Ana.O'Neil+x@example.com", "first-expense");
    expect(key).toMatch(/^ga\.celebrate\.[0-9a-f]{8}\.first-expense$/);
    expect(key).not.toMatch(/ana|example/i);
    expect(celebrationKey(" ANA.O'NEIL+X@EXAMPLE.COM ", "first-expense")).toBe(key);
    expect(celebrationKey("b@example.com", "first-expense")).not.toBe(key);
  });

  it("reads as already seen when the store throws", async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("locked"));
    expect(await hasCelebrated("a@example.com", "goal-7")).toBe(true);
  });

  it("does not reject when the store cannot be written", async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("locked"));
    await expect(markCelebrated("a@example.com", "goal-7")).resolves.toBeUndefined();
  });
});
