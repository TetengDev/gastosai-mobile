import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import * as ReactNative from "react-native";
import { processColor } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { Piso } from "./Piso";
import { accents, palettes } from "../theme";

/**
 * A primitive's colour props serialise through react-native-svg's test renderer as
 * `{ type: 0, payload: <int> }`, not the hex string passed in — `processColor` is the same
 * conversion RN itself uses, so comparing payloads is comparing the actual resolved colour, not
 * a string that happens to look right.
 */
function colorPayload(value: string): number {
  return processColor(value) as number;
}

type SvgNode = { type?: string; props?: Record<string, unknown>; children?: SvgNode[] | null };

function findAll(node: SvgNode | null, predicate: (n: SvgNode) => boolean): SvgNode[] {
  if (!node) return [];
  const self = predicate(node) ? [node] : [];
  const kids = node.children ?? [];
  return self.concat(kids.flatMap((k) => findAll(k, predicate)));
}

function fillPayload(node: SvgNode): unknown {
  return (node.props?.fill as { payload?: unknown } | undefined)?.payload;
}

function strokePayload(node: SvgNode): unknown {
  return (node.props?.stroke as { payload?: unknown } | undefined)?.payload;
}

/**
 * Piso (TEN-434): a bamboo alkansya, not an animal — this file pins the geometry contract
 * (no Reanimated/Animated, the 32px mark/face threshold, and the three accessibility pairings)
 * rather than pixel values, since the artwork itself is provisional by the user's own decision.
 */

function tree() {
  return JSON.stringify(screen.toJSON());
}

describe("Piso renders all seven states", () => {
  it.each(["resting", "saved", "empty", "overBudget", "thinking", "worried", "cheer"] as const)(
    "renders %s without throwing",
    (state) => {
      const { toJSON } = render(<Piso state={state} />);
      expect(toJSON()).toBeTruthy();
    },
  );
});

describe("the five announced states expose their label", () => {
  it("saved reads as 'Expense saved'", () => {
    render(<Piso state="saved" testID="piso" />);
    const el = screen.getByTestId("piso");
    expect(el.props.accessible).toBe(true);
    expect(el.props.accessibilityRole).toBe("image");
    expect(el.props.accessibilityLabel).toBe("Expense saved");
  });

  it("overBudget reads as 'Over budget'", () => {
    render(<Piso state="overBudget" testID="piso" />);
    const el = screen.getByTestId("piso");
    expect(el.props.accessible).toBe(true);
    expect(el.props.accessibilityRole).toBe("image");
    expect(el.props.accessibilityLabel).toBe("Over budget");
  });

  it("thinking reads as 'Thinking'", () => {
    render(<Piso state="thinking" testID="piso" />);
    const el = screen.getByTestId("piso");
    expect(el.props.accessible).toBe(true);
    expect(el.props.accessibilityRole).toBe("image");
    expect(el.props.accessibilityLabel).toBe("Thinking");
  });

  it("worried reads as 'Close to budget'", () => {
    render(<Piso state="worried" testID="piso" />);
    const el = screen.getByTestId("piso");
    expect(el.props.accessible).toBe(true);
    expect(el.props.accessibilityRole).toBe("image");
    expect(el.props.accessibilityLabel).toBe("Close to budget");
  });

  it("cheer reads as 'Celebrating'", () => {
    render(<Piso state="cheer" testID="piso" />);
    const el = screen.getByTestId("piso");
    expect(el.props.accessible).toBe(true);
    expect(el.props.accessibilityRole).toBe("image");
    expect(el.props.accessibilityLabel).toBe("Celebrating");
  });
});

describe("the two decorative states are hidden from assistive technology", () => {
  it("resting is not exposed by default and carries the hidden flags", () => {
    render(<Piso state="resting" testID="piso" />);

    // Not found without opting into hidden elements — this is the behaviour the accessibility
    // flags below exist to produce, not just their presence as props.
    expect(screen.queryByTestId("piso")).toBeNull();

    const el = screen.getByTestId("piso", { includeHiddenElements: true });
    expect(el.props.accessibilityElementsHidden).toBe(true);
    expect(el.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("empty is not exposed by default and carries the hidden flags", () => {
    render(<Piso state="empty" testID="piso" />);

    expect(screen.queryByTestId("piso")).toBeNull();

    const el = screen.getByTestId("piso", { includeHiddenElements: true });
    expect(el.props.accessibilityElementsHidden).toBe(true);
    expect(el.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});

describe("the 32px threshold lives inside the component", () => {
  it("size={24} renders the faceless mark — no eye circles", () => {
    render(<Piso state="resting" size={24} testID="piso" />);
    // The mark has a coin (r=8.5) but never the full character's eyes (r=4.2). Their absence is
    // what distinguishes it from the full face below.
    expect(tree()).not.toMatch(/"r":4\.2/);
  });

  it("size={96} renders the full face — eye circles present", () => {
    render(<Piso state="resting" size={96} testID="piso" />);
    // The full character's eyes are two Circle primitives at r=4.2; their presence is what a
    // scaled-down version of the face would have had to fake, which the 32px threshold forbids.
    expect(tree()).toMatch(/RNSVGCircle/);
    expect(tree()).toMatch(/"r":4\.2/);
  });

  it("never renders a scaled-down face just under the threshold", () => {
    render(<Piso state="resting" size={31} testID="piso" />);
    expect(tree()).not.toMatch(/"r":4\.2/);
  });
});

/**
 * TEN-554: the below-32px mark is the workspace's `docs/brand/gastosai-mark-small.svg` — coin
 * sinking into a bamboo tube, two joints sticking out past it — so the in-app mark, the app icon
 * and the web favicon are one drawing. Geometry is pinned to the master's numbers; colours still
 * come from the mood tokens.
 */
describe("the small mark is the brand mark", () => {
  function mark(state: "resting" | "empty" | "overBudget") {
    const { toJSON } = render(<Piso state={state} size={24} testID="piso" />);
    const root = toJSON() as SvgNode;
    const [coin] = findAll(root, (n) => n.type === "RNSVGCircle" && n.props?.r === 8.5);
    // The tube is the last 26-wide rect: an opaque backing of the same geometry sits under it.
    const [, tube] = findAll(root, (n) => n.type === "RNSVGRect" && n.props?.width === 26);
    const [joints] = findAll(
      root,
      (n) => n.type === "RNSVGPath" && n.props?.d === "M14.5 33h35M14.5 47h35",
    );
    return { root, coin, tube, joints };
  }

  it("draws a coin, a tube and two joints at the master's geometry", () => {
    const { coin, tube, joints } = mark("resting");

    expect(coin?.props).toMatchObject({ cx: 32, cy: 15, r: 8.5, strokeWidth: 4 });
    expect(tube?.props).toMatchObject({ x: 19, y: 19, width: 26, height: 41, rx: 7, strokeWidth: 4 });
    expect(joints?.props).toMatchObject({ strokeWidth: 4.5 });
  });

  it("sinks the coin into the tube — the tube is drawn over it", () => {
    const { root } = mark("resting");
    const order = findAll(root, (n) => n.type === "RNSVGCircle" || n.type === "RNSVGRect").map(
      (n) => n.type,
    );
    expect(order).toEqual(["RNSVGCircle", "RNSVGRect", "RNSVGRect"]);
  });

  it("keeps its testID", () => {
    render(<Piso state="saved" size={24} testID="piso" />);
    expect(screen.getByTestId("piso")).toBeTruthy();
  });

  it("resting: mint body, deep line, gold coin", () => {
    const { coin, tube, joints } = mark("resting");

    expect(fillPayload(tube)).toBe(colorPayload(palettes.light.greenSoft));
    expect(strokePayload(tube)).toBe(colorPayload(palettes.light.greenHi));
    expect(strokePayload(joints)).toBe(colorPayload(palettes.light.greenHi));
    expect(fillPayload(coin)).toBe(colorPayload(palettes.light.coin));
    expect(strokePayload(coin)).toBe(colorPayload(palettes.light.greenHi));
  });

  it("empty: warm panel body, same line", () => {
    const { tube } = mark("empty");

    expect(fillPayload(tube)).toBe(colorPayload(palettes.light.surface3));
    expect(strokePayload(tube)).toBe(colorPayload(palettes.light.greenHi));
  });

  it("overBudget: the whole mark moves to the amber pair", () => {
    const { coin, tube, joints } = mark("overBudget");

    expect(fillPayload(tube)).toBe(colorPayload(palettes.light.warnBg));
    expect(strokePayload(tube)).toBe(colorPayload(palettes.light.warnText));
    expect(strokePayload(joints)).toBe(colorPayload(palettes.light.warnText));
    expect(strokePayload(coin)).toBe(colorPayload(palettes.light.warnText));
  });
});

describe("colour roles meet contrast, not just availability", () => {
  // TEN-434 review: accents.brand (#1f8a5b) was the stand-in body fill, and it measured 2.86:1
  // against the deep-green line — nowhere near the 8.44:1 the spec's pale mint gives. These pin
  // the corrected tokens by their actual resolved colour, not by trusting the source read right.
  it("resting fills the body with the pale mint, not the brand accent", () => {
    const { toJSON } = render(<Piso state="resting" />);
    const [body] = findAll(toJSON(), (n) => n.type === "RNSVGRect" && n.props?.width === 72);

    expect(fillPayload(body)).toBe(colorPayload(palettes.light.greenSoft));
    expect(fillPayload(body)).not.toBe(colorPayload(accents.brand));
  });

  it("resting lines the body with greenHi, not the hero constant's old role", () => {
    const { toJSON } = render(<Piso state="resting" />);
    const [body] = findAll(toJSON(), (n) => n.type === "RNSVGRect" && n.props?.width === 72);

    // greenHi (light) and hero are numerically equal (#003c33), so this does not distinguish
    // which token the source reads — the point is only that the stroke is the deep-green pair's
    // own value, which it is either way. The body-fill test above is where the real fix shows.
    expect(strokePayload(body)).toBe(colorPayload(palettes.light.greenHi));
  });

  it("empty swaps the body to the warm panel, keeping the same line", () => {
    const { toJSON } = render(<Piso state="empty" />);
    const [body] = findAll(toJSON(), (n) => n.type === "RNSVGRect" && n.props?.width === 72);

    expect(fillPayload(body)).toBe(colorPayload(palettes.light.surface3));
    expect(strokePayload(body)).toBe(colorPayload(palettes.light.greenHi));
  });

  it("the saved coin is gold (coin/warnText), not the vivid amber accent", () => {
    const { toJSON } = render(<Piso state="saved" />);
    const [coin] = findAll(toJSON(), (n) => n.type === "RNSVGCircle" && n.props?.r === 9);

    expect(fillPayload(coin)).toBe(colorPayload(palettes.light.coin));
    expect(strokePayload(coin)).toBe(colorPayload(palettes.light.warnText));
    expect(fillPayload(coin)).not.toBe(colorPayload(accents.amber));
  });

  it("cheer shares saved's crescent eyes but not its coin", () => {
    const { toJSON } = render(<Piso state="cheer" />);
    expect(findAll(toJSON(), (n) => n.type === "RNSVGCircle" && n.props?.r === 9)).toHaveLength(0);
    expect(findAll(toJSON(), (n) => n.type === "RNSVGCircle" && n.props?.r === 4.2)).toHaveLength(0);
  });

  it("thinking's dots are coloured with the line token, not a hardcoded accent", () => {
    const { toJSON } = render(<Piso state="thinking" />);
    const dots = findAll(toJSON(), (n) => n.type === "RNSVGCircle" && n.props?.r === 5);

    expect(dots).toHaveLength(3);
    for (const dot of dots) {
      expect(fillPayload(dot)).toBe(colorPayload(palettes.light.greenHi));
    }
  });

  it("overBudget recolours the whole figure into the amber pair, never the danger token", () => {
    const { toJSON } = render(<Piso state="overBudget" />);
    const [body] = findAll(toJSON(), (n) => n.type === "RNSVGRect" && n.props?.width === 72);

    expect(fillPayload(body)).toBe(colorPayload(palettes.light.warnBg));
    expect(strokePayload(body)).toBe(colorPayload(palettes.light.warnText));
    expect(strokePayload(body)).not.toBe(colorPayload(accents.danger));
  });
});

/**
 * TEN-554 review, matching web's TEN-553: in dark, `warnBorder` is a 20% wash and `warnBg` a 7%
 * one. The coin filled from `warnBorder` read as an empty ring, and an overBudget tube filled from
 * `warnBg` let the coin show through its lower half. The coin now has its own role, and the small
 * mark's tube sits on an opaque backing.
 */
describe("in dark mode", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function darkRender(state: "saved" | "overBudget", size: number) {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    return render(<Piso state={state} size={size} />).toJSON() as SvgNode;
  }

  it("the small mark's coin is solid gold, not the 20% warn wash", () => {
    const [coin] = findAll(darkRender("overBudget", 24), (n) => n.props?.r === 8.5);

    expect(fillPayload(coin)).toBe(colorPayload(palettes.dark.coin));
    expect(fillPayload(coin)).not.toBe(colorPayload(palettes.dark.warnBorder));
  });

  it("the saved state's coin is solid gold too", () => {
    const [coin] = findAll(darkRender("saved", 96), (n) => n.props?.r === 9);

    expect(fillPayload(coin)).toBe(colorPayload(palettes.dark.coin));
  });

  it("an overBudget tube sits on an opaque backing, so the coin cannot show through it", () => {
    const [backing, tube] = findAll(
      darkRender("overBudget", 24),
      (n) => n.type === "RNSVGRect" && n.props?.width === 26,
    );

    expect(backing?.props).toMatchObject({ x: 19, y: 19, width: 26, height: 41, rx: 7 });
    expect(fillPayload(backing)).toBe(colorPayload(palettes.dark.surface));
    expect(fillPayload(tube)).toBe(colorPayload(palettes.dark.warnBg));
  });
});

describe("no animation", () => {
  it("does not import Reanimated or react-native's Animated API", () => {
    // Static per the brief: no Reanimated, no Animated, nothing. A later PR adding motion would
    // touch this file's imports, which is exactly what this guard reads — not the prose
    // describing that absence, which is free to say the word.
    const importLines = readFileSync(join(__dirname, "Piso.tsx"), "utf8")
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));

    expect(importLines.some((line: string) => line.includes("react-native-reanimated"))).toBe(
      false,
    );
    expect(importLines.some((line: string) => /\bAnimated\b/.test(line))).toBe(false);
  });
});
