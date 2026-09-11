import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { affectedQueryKeys, confirmChatAction, isDestructive } from "./chatActions";

// babel-jest hoists this `jest.mock` above the import above it, so `chatActions` gets the mock
// rather than a real axios instance that would try to reach the network. The `mock` prefix on the
// spy is what lets the factory close over it — jest rejects any other name there.
const mockPost = jest.fn();
jest.mock("../../api/client", () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
  API_BASE_URL: "http://api.test",
}));
const post = mockPost;

/**
 * Confirming is structural: the `toolName` and `params` the server proposed go straight back.
 *
 * The previous shape rebuilt an English sentence from the proposal and posted it to `/ai/chat` for
 * the backend to parse a second time, which meant mobile and web had to phrase every tool
 * identically and a tool with no phrasing could not be confirmed at all (TEN-168). These tests pin
 * the parts of the replacement that are wrong silently — a rebuilt sentence, a converted amount, or
 * the versioned base URL would all still return 200.
 */
describe("confirmChatAction", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { message: "Added.", type: "action" } } as never);
  });

  it("posts the proposed toolName and params, with no sentence rebuilt", async () => {
    await confirmChatAction("create_expense", { amount: "150.00", category: "Food" }, 42);

    const [url, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe("/ai/chat/confirm");
    expect(body).toEqual({
      toolName: "create_expense",
      params: { amount: "150.00", category: "Food" },
      mode: "execute",
      conversationId: 42,
    });
    expect(Object.keys(body)).not.toContain("message");
  });

  it("echoes params byte-for-byte, including the decimal amount", async () => {
    // A preview's params are the v1 decimal arguments. Converting one to centavos on the way out
    // would confirm the amount a hundredfold, and the request would still succeed.
    const params = { amount: "1250.50", note: "lunch", nested: { keep: true } };
    await confirmChatAction("create_expense", params);

    const [, body] = post.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(body.params).toEqual(params);
  });

  it("overrides the client's /api/v2 base, because confirm is published unversioned only", async () => {
    await confirmChatAction("create_budget", {});

    const [, , config] = post.mock.calls[0] as [string, unknown, { baseURL: string; timeout: number }];
    expect(config.baseURL).toBe("http://api.test");
    // Confirming runs the tool against the database; the CRUD-sized default aborts mid-answer.
    expect(config.timeout).toBe(90_000);
  });

  it("omits conversationId rather than sending null when there is no thread yet", async () => {
    await confirmChatAction("list_goals", {});

    const [, body] = post.mock.calls[0] as [string, { conversationId?: number }];
    expect(body.conversationId).toBeUndefined();
  });

  it("returns the assistant turn the server answered with", async () => {
    post.mockResolvedValue({ data: { message: "Added ₱150.", type: "action" } } as never);
    await expect(confirmChatAction("create_expense", {})).resolves.toEqual({
      message: "Added ₱150.",
      type: "action",
    });
  });
});

/** Colours the confirm button. Under-flagging a delete is the failure that matters. */
describe("isDestructive", () => {
  it("flags deletes and the bulk recategorize", () => {
    expect(isDestructive("delete_category")).toBe(true);
    expect(isDestructive("delete_expenses")).toBe(true);
    expect(isDestructive("recategorize_expenses")).toBe(true);
  });

  it("does not flag creates, updates or reads", () => {
    expect(isDestructive("create_expense")).toBe(false);
    expect(isDestructive("update_budget")).toBe(false);
    expect(isDestructive("list_goals")).toBe(false);
  });
});

/**
 * What an executed tool made stale. Over-invalidating is cheap; a stale number on screen is not.
 */
describe("affectedQueryKeys", () => {
  it("invalidates the report alongside expenses and budgets", () => {
    expect(affectedQueryKeys("create_expense")).toEqual([["expenses"], ["report"], ["budgets"]]);
  });

  it("invalidates expenses for a category change, since every row carries its category", () => {
    expect(affectedQueryKeys("rename_category")).toEqual([
      ["categories"],
      ["expenses"],
      ["report"],
    ]);
  });

  it("invalidates everything for a tool it does not recognise", () => {
    // A tool added backend-side must not leave this client showing stale numbers until it ships.
    expect(affectedQueryKeys("something_new")).toEqual([
      ["expenses"],
      ["report"],
      ["budgets"],
      ["goals"],
      ["categories"],
      ["alerts"],
    ]);
  });
});
