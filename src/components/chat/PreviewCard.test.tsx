import { describe, expect, it, jest } from "@jest/globals";
import { render, screen, userEvent } from "@testing-library/react-native";
import PreviewCard, { previewFields } from "./PreviewCard";

/**
 * What the user is shown before they approve a write (TEN-377).
 *
 * The card's job is that the thing approved is the thing displayed. `confirmChatAction` sends
 * `preview.params` whole, so any entry the card does not render is executed unseen — which is what
 * the old scalars-only filter did. These tests pin both halves of the fix: nothing is dropped, and
 * "[object Object]" — the reason that filter was added — never reaches the screen.
 */

function renderCard(params: Record<string, unknown>, onConfirm = jest.fn()) {
  render(
    <PreviewCard
      preview={{ toolName: "search_expenses", params }}
      confirmed={false}
      pending={false}
      onConfirm={onConfirm}
      onCancel={jest.fn()}
    />,
  );
}

/** Every string rendered anywhere in the card, so a leaked "[object Object]" cannot hide. */
function renderedText(): string {
  return JSON.stringify(screen.toJSON());
}

describe("previewFields", () => {
  it("expands a nested object into one row per leaf", () => {
    expect(previewFields({ range: { from: "2026-06-01", to: "2026-06-30" }, limit: 20 })).toEqual([
      { key: "range.from", value: "2026-06-01" },
      { key: "range.to", value: "2026-06-30" },
      { key: "limit", value: "20" },
    ]);
  });

  it("joins a list of scalars into one row", () => {
    expect(previewFields({ expenseIds: [4, 9, 12] })).toEqual([
      { key: "expenseIds", value: "4, 9, 12" },
    ]);
  });

  it("indexes a list of objects", () => {
    expect(previewFields({ rules: [{ category: "Food" }, { category: "Transport" }] })).toEqual([
      { key: "rules[0].category", value: "Food" },
      { key: "rules[1].category", value: "Transport" },
    ]);
  });

  it("renders an absent value rather than hiding a field that is still sent", () => {
    expect(previewFields({ note: null, tag: undefined })).toEqual([
      { key: "note", value: "—" },
      { key: "tag", value: "—" },
    ]);
  });

  it("says so for an empty object or list", () => {
    expect(previewFields({ filters: {}, ids: [] })).toEqual([
      { key: "filters", value: "(none)" },
      { key: "ids", value: "(none)" },
    ]);
  });

  it("falls back to JSON past the depth cap instead of [object Object]", () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };

    const fields = previewFields(deep);

    expect(fields).toEqual([{ key: "a.b.c.d.e", value: '{"f":1}' }]);
    expect(fields[0].value).not.toContain("[object Object]");
  });
});

describe("PreviewCard", () => {
  it("shows a nested param instead of silently dropping it", () => {
    renderCard({
      range: { from: "2026-06-01", to: "2026-06-30" },
      categoryIds: [3, 7],
      limit: 20,
    });

    // The rows the old filter removed while `confirmChatAction` kept sending them.
    expect(screen.getByText("range.from")).toBeOnTheScreen();
    expect(screen.getByText("2026-06-01")).toBeOnTheScreen();
    expect(screen.getByText("range.to")).toBeOnTheScreen();
    expect(screen.getByText("2026-06-30")).toBeOnTheScreen();
    expect(screen.getByText("categoryIds")).toBeOnTheScreen();
    expect(screen.getByText("3, 7")).toBeOnTheScreen();
    // The scalars that always worked still do.
    expect(screen.getByText("limit")).toBeOnTheScreen();
    expect(screen.getByText("20")).toBeOnTheScreen();
  });

  it("never renders [object Object]", () => {
    renderCard({ filter: { merchant: "Jollibee", nested: { deep: { deeper: { x: 1 } } } } });

    expect(renderedText()).not.toContain("[object Object]");
  });

  it("still confirms the action it displayed", async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();

    renderCard({ range: { from: "2026-06-01", to: "2026-06-30" } }, onConfirm);
    await user.press(screen.getByTestId("chat-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
