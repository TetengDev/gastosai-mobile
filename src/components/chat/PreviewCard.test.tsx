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

  it("bounds the number of rows and counts the ones it left out", () => {
    // One row per leaf with no ceiling is what froze the confirm screen (TEN-422).
    const rules = Array.from({ length: 3000 }, (_, i) => ({ category: `c${i}` }));

    const fields = previewFields({ rules });

    expect(fields.length).toBeLessThanOrEqual(41);
    const last = fields[fields.length - 1];
    expect(last.elided).toBe(true);
    // 3000 leaves, 40 of them rendered.
    expect(last.key).toBe("+2960 more");
    // The rows that are shown are still real rows, not a placeholder list.
    expect(fields[0]).toEqual({ key: "rules[0].category", value: "c0" });
  });

  it("stops walking a payload far past the cap, and says the count is a floor", () => {
    // Capping rows alone only throttles the cost — a million leaves still cost a million calls on
    // the main thread. 400k here: the walk must stop, not merely stop rendering.
    const rules = Array.from({ length: 400_000 }, (_, i) => ({ category: `c${i}` }));

    const started = Date.now();
    const fields = previewFields({ rules });
    const elapsed = Date.now() - started;

    expect(fields.length).toBeLessThanOrEqual(41);
    // 5000 leaves visited, 40 of them rendered — and the count is disclosed as a floor, because
    // the rest were never visited.
    expect(fields[fields.length - 1]).toEqual({
      key: "+5000 or more",
      value: "not shown",
      elided: true,
    });
    // Generous, so the assertion is about the bound and not about this machine: 400k leaves walked
    // would not come close.
    expect(elapsed).toBeLessThan(500);
  });

  it("decides an array's shape on a prefix rather than reading all of it", () => {
    // `every(isScalar)` was one unbounded pass before any cap engaged, and a list of ids is the
    // easiest wide payload to propose — the row cap never saw it because it renders as one row.
    const expenseIds = Array.from({ length: 500_000 }, (_, i) => i);

    const started = Date.now();
    const fields = previewFields({ expenseIds });
    const elapsed = Date.now() - started;

    expect(fields).toHaveLength(1);
    expect(fields[0].value).toContain("of 500000 not shown");
    expect(elapsed).toBeLessThan(500);
  });

  it("enumerates a very wide object lazily instead of materialising its entries", () => {
    const filters: Record<string, unknown> = {};
    for (let i = 0; i < 200_000; i += 1) filters[`k${i}`] = i;

    const started = Date.now();
    const fields = previewFields({ filters });
    const elapsed = Date.now() - started;

    expect(fields.length).toBeLessThanOrEqual(41);
    expect(fields[fields.length - 1].key).toBe("+5000 or more");
    expect(elapsed).toBeLessThan(500);
  });

  it("refuses to serialise a huge subtree past the depth cap, and says it is not shown", () => {
    // One row, so `MAX_ROWS` cannot see its size: `JSON.stringify` would have built the whole
    // thing to have 200 characters of it clamped back out.
    const huge = Array.from({ length: 300_000 }, (_, i) => ({ i }));
    const deep = { a: { b: { c: { d: { e: huge } } } } };

    const started = Date.now();
    const fields = previewFields(deep);
    const elapsed = Date.now() - started;

    expect(fields).toEqual([
      { key: "a.b.c.d.e", value: "(300000 items, too large to show)", elided: true },
    ]);
    expect(elapsed).toBeLessThan(500);
  });

  it("still shows a small depth-capped subtree as JSON", () => {
    // The probe must not turn every depth-capped value into "not shown" — an ordinary one is
    // readable, which is the whole reason the JSON fallback exists.
    expect(previewFields({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toEqual([
      { key: "a.b.c.d.e", value: '{"f":1}' },
    ]);
  });

  it("bounds the length of a single value and says how much it cut", () => {
    const note = "x".repeat(5000);

    const [field] = previewFields({ note });

    expect(field.value.length).toBeLessThan(260);
    expect(field.value).toContain("(+4800 more characters)");
  });

  it("bounds a long list of scalars without joining the whole thing first", () => {
    const expenseIds = Array.from({ length: 4000 }, (_, i) => i);

    const fields = previewFields({ expenseIds });

    expect(fields).toHaveLength(1);
    // Bounded, and bounded by the list builder itself — not cut again afterwards, which would
    // have taken the disclosure off the end of the row carrying it.
    expect(fields[0].value.length).toBeLessThanOrEqual(200);
    expect(fields[0].value).toContain("of 4000 not shown");
    expect(fields[0].value).not.toContain("more characters");
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

  it("discloses an over-wide payload and offers no confirm for it", () => {
    renderCard({ rules: Array.from({ length: 3000 }, (_, i) => ({ category: `c${i}` })) });

    // Bounded: 40 param rows, each two Text nodes, plus the disclosure row.
    expect(screen.getAllByText(/^rules\[/)).toHaveLength(40);
    // Visible: the user can see the card is not showing everything it would send.
    expect(screen.getByText("+2960 more")).toBeOnTheScreen();
    expect(screen.getByTestId("chat-preview-incomplete")).toBeOnTheScreen();
    // And cannot approve what they were not shown — only Cancel is left.
    expect(screen.queryByTestId("chat-confirm")).toBeNull();
    expect(screen.getByTestId("chat-cancel")).toBeOnTheScreen();
  });

  it("still confirms the action it displayed", async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();

    renderCard({ range: { from: "2026-06-01", to: "2026-06-30" } }, onConfirm);
    await user.press(screen.getByTestId("chat-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
