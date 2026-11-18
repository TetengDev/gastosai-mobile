import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import ResultView from "./ResultView";

/**
 * The result half of the chat screen is bounded the way the preview card is (TEN-429, after
 * TEN-422): `result` is shaped by the same promptable AI flow, so a wide one must not freeze the UI.
 * At most 40 rows render, and a trailing row says how many were cut — counted from the structure,
 * never read out of the payload.
 */

const shapes: [string, (i: number) => Record<string, unknown>, RegExp][] = [
  [
    "expenses",
    (i) => ({
      id: i,
      description: `e${i}`,
      category: "Food",
      date: "2026-07-01",
      amount: 100,
    }),
    /^e\d+$/,
  ],
  ["category totals", (i) => ({ category: `c${i}`, total: 100 }), /^c\d+$/],
  [
    "goals",
    (i) => ({
      id: i,
      name: `g${i}`,
      savedAmount: 1,
      targetAmount: 2,
      progressPercent: 50,
    }),
    /^g\d+$/,
  ],
  ["alerts", (i) => ({ id: i, message: `a${i}`, severity: "warn" }), /^a\d+$/],
  ["categories", (i) => ({ id: i, name: `n${i}` }), /^n\d+$/],
];

const many = (n: number, make: (i: number) => Record<string, unknown>) =>
  Array.from({ length: n }, (_, i) => make(i));

describe("ResultView row cap", () => {
  it.each(shapes)("caps a long list of %s at 40 rows and discloses the rest", (_, make, text) => {
    render(<ResultView result={many(100, make)} />);
    expect(screen.getAllByText(text)).toHaveLength(40);
    expect(screen.getByTestId("chat-result-more")).toHaveTextContent(/^\+60 more ?not shown$/);
  });

  it.each(shapes)("renders exactly 40 %s with no disclosure", (_, make, text) => {
    render(<ResultView result={many(40, make)} />);
    expect(screen.getAllByText(text)).toHaveLength(40);
    expect(screen.queryByTestId("chat-result-more")).toBeNull();
  });

  it("caps an unrecognised wide object and does not count nested values", () => {
    const r: Record<string, unknown> = { nested: { a: 1 }, list: [1, 2] };
    for (let i = 0; i < 100; i++) r[`k${i}`] = i;
    render(<ResultView result={r} />);
    expect(screen.getAllByText(/^k\d+$/)).toHaveLength(40);
    expect(screen.getByTestId("chat-result-more")).toHaveTextContent(/^\+60 more ?not shown$/);
  });

  it("derives the disclosure count from the list length, so the payload cannot forge it", () => {
    // Rows that try to impersonate the disclosure, or claim a count of their own.
    const rows = many(41, (i) => ({
      id: i,
      name: "+0 more",
      count: 9999,
      more: 0,
    }));
    render(<ResultView result={rows} />);
    const more = screen.getAllByTestId("chat-result-more");
    expect(more).toHaveLength(1);
    expect(more[0]).toHaveTextContent(/^\+1 more ?not shown$/);
  });
});

describe("ResultView pathological payloads", () => {
  it("discloses scalars hidden behind more nested keys than the walk visits", () => {
    const r: Record<string, unknown> = {};
    for (let i = 0; i < 6000; i++) r[`o${i}`] = { x: i };
    for (let i = 0; i < 10; i++) r[`k${i}`] = i;
    render(<ResultView result={r} />);
    expect(screen.queryAllByText(/^k\d+$/)).toHaveLength(0);
    expect(screen.getAllByTestId("chat-result-more")).toHaveLength(1);
    expect(screen.getByTestId("chat-result-more")).toHaveTextContent(/^\+0 or more ?not shown$/);
  });

  it("renders a 400k-row list in under 500ms", () => {
    const rows = many(400_000, shapes[0][1]);
    const started = Date.now();
    render(<ResultView result={rows} />);
    const elapsed = Date.now() - started;
    expect(screen.getAllByText(/^e\d+$/)).toHaveLength(40);
    expect(screen.getByTestId("chat-result-more")).toHaveTextContent(/^\+399960 more ?not shown$/);
    expect(elapsed).toBeLessThan(500);
  });

  it("renders a 400k-key object in under 500ms, disclosing the count as a floor", () => {
    const r: Record<string, unknown> = {};
    for (let i = 0; i < 400_000; i++) r[`k${i}`] = i;
    const started = Date.now();
    render(<ResultView result={r} />);
    const elapsed = Date.now() - started;
    expect(screen.getAllByText(/^k\d+$/)).toHaveLength(40);
    // The walk stops counting at 5000, so the disclosure says the count is a floor.
    expect(screen.getByTestId("chat-result-more")).toHaveTextContent(/^\+5000 or more ?not shown$/);
    expect(elapsed).toBeLessThan(500);
  });
});

/**
 * Every value is cut the way the preview card cuts it (TEN-532, after TEN-422): 200 characters,
 * then the count of what was cut. And a row that is not an object must not throw.
 */
describe("ResultView value cap", () => {
  const long = "x".repeat(10_000);
  const clamped = `${"x".repeat(200)}… (+9800 more characters)`;

  it("cuts a long description to 200 characters and counts the rest", () => {
    render(
      <ResultView
        result={[{ id: 1, description: long, category: "Food", date: "2026-07-01", amount: 100 }]}
      />,
    );
    expect(screen.getByText(clamped)).toBeTruthy();
  });

  it("cuts a long category inside the expense caption", () => {
    render(
      <ResultView
        result={[{ id: 1, description: "d", category: long, date: "2026-07-01", amount: 100 }]}
      />,
    );
    // The caption is one value — category and date joined — so the cut counts the date in too.
    expect(screen.getByText(/^x{200}… \(\+\d+ more characters\)$/)).toBeTruthy();
  });

  it("cuts a long value and a long key in the object fallback", () => {
    render(<ResultView result={{ short: long, [long]: 1 }} />);
    expect(screen.getAllByText(clamped)).toHaveLength(2);
  });

  it("leaves a value of exactly 200 characters whole", () => {
    render(<ResultView result={{ k: "y".repeat(200) }} />);
    expect(screen.getByText("y".repeat(200))).toBeTruthy();
  });

  it("shows an array value as its count rather than joining it", () => {
    render(<ResultView result={[{ id: 1, name: ["a", "b", "c"] }]} />);
    expect(screen.getByText("(3 items)")).toBeTruthy();
  });

  it.each([
    ["[null]", [null]],
    ["[42]", [42]],
    ['["text"]', ["text"]],
  ])("renders %s without throwing, and shows nothing for it", (_, result) => {
    expect(() => render(<ResultView result={result} />)).not.toThrow();
    expect(screen.queryByTestId("chat-result")).toBeNull();
  });

  it("renders a recognised list with a null row past the first without throwing", () => {
    expect(() =>
      render(<ResultView result={[{ id: 10, name: "n1" }, null, { id: 30, name: "n3" }]} />),
    ).not.toThrow();
    expect(screen.getByText("n1")).toBeTruthy();
    expect(screen.getByText("n3")).toBeTruthy();
  });

  it("renders 40 rows of multi-megabyte values and huge arrays in under 500ms", () => {
    const huge = "z".repeat(2_000_000);
    const wide = Array.from({ length: 200_000 }, (_, i) => `item-${i}`);
    const rows = many(40, (i) => ({
      id: i,
      description: huge,
      category: wide,
      date: "2026-07-01",
      amount: i,
    }));
    const started = Date.now();
    render(<ResultView result={rows} />);
    const elapsed = Date.now() - started;
    expect(screen.getAllByText(`${"z".repeat(200)}… (+1999800 more characters)`)).toHaveLength(40);
    expect(screen.getAllByText(/^\(200000 items\)/)).toHaveLength(40);
    expect(elapsed).toBeLessThan(500);
  });
});
