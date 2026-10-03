import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "@jest/globals";
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

describe("Piso renders all five states", () => {
  it.each(["resting", "saved", "empty", "overBudget", "thinking"] as const)(
    "renders %s without throwing",
    (state) => {
      const { toJSON } = render(<Piso state={state} />);
      expect(toJSON()).toBeTruthy();
    },
  );
});

describe("the three announced states expose their label", () => {
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
    // The mark (viewBox 0 0 24 24) has no Circle primitive at all: just the two Rects and the
    // one Path. Its absence here is what distinguishes it from the full face below.
    expect(tree()).not.toMatch(/RNSVGCircle/);
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
    expect(tree()).not.toMatch(/RNSVGCircle/);
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

  it("the saved coin is gold (warnBorder/warnText), not the vivid amber accent", () => {
    const { toJSON } = render(<Piso state="saved" />);
    const [coin] = findAll(toJSON(), (n) => n.type === "RNSVGCircle" && n.props?.r === 9);

    expect(fillPayload(coin)).toBe(colorPayload(palettes.light.warnBorder));
    expect(strokePayload(coin)).toBe(colorPayload(palettes.light.warnText));
    expect(fillPayload(coin)).not.toBe(colorPayload(accents.amber));
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
