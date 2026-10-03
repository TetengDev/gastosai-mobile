import { describe, expect, it } from "@jest/globals";
import { accents, fontSizes, palettes } from "./index";

/**
 * Fidelity guard.
 *
 * These are not arbitrary brand colours — they are copied from
 * `gastosai-web/src/index.css` so the two products look like one product. A mistyped hex is
 * invisible in review and nearly invisible on screen, but it is exactly the drift this file
 * exists to prevent. If web's tokens change, these fail and force a deliberate re-sync.
 */
describe("palette matches gastosai-web", () => {
  it("light matches :root", () => {
    expect(palettes.light).toEqual({
      page: "#ffffff",
      surface: "#ffffff",
      surface2: "#fafafa",
      surface3: "#eeece7",
      surface4: "#f7f7f5",
      track: "#f1f1ef",
      border: "#e5e7eb",
      border2: "#ededed",
      border3: "#f2f2f2",
      borderInput: "#d9d9dd",
      textHi: "#17171c",
      text: "#212121",
      text2: "#5d5d6e",
      text3: "#71717a",
      inputBg: "#ffffff",
      cta: "#17171c",
      ctaFg: "#ffffff",
      greenHi: "#003c33",
      greenSoft: "#9fe3c9",
      warnBg: "#fff8ea",
      warnBorder: "#f0dca0",
      warnText: "#8a6a00",
    });
  });

  it("dark matches .dark", () => {
    expect(palettes.dark).toEqual({
      page: "#0f0f13",
      surface: "#17171c",
      surface2: "#1e1e24",
      surface3: "#0d1f1a",
      surface4: "#1a1a1f",
      track: "rgba(255, 255, 255, 0.07)",
      border: "rgba(255, 255, 255, 0.09)",
      border2: "rgba(255, 255, 255, 0.07)",
      border3: "rgba(255, 255, 255, 0.05)",
      borderInput: "rgba(255, 255, 255, 0.15)",
      textHi: "#f0f0f0",
      text: "#e0e0e8",
      text2: "#8b8b9e",
      text3: "#6b6b7a",
      inputBg: "#1e1e24",
      cta: "#f0f0f0",
      ctaFg: "#17171c",
      greenHi: "#7fd6b8",
      greenSoft: "#003c33",
      warnBg: "rgba(240, 220, 160, 0.07)",
      warnBorder: "rgba(240, 220, 160, 0.2)",
      warnText: "#d4b060",
    });
  });

  it("accents are constant across schemes", () => {
    expect(accents.brand).toBe("#1f8a5b");
    expect(accents.link).toBe("#1863dc");
    expect(accents.danger).toBe("#b30000");
  });

  it("the CTA inverts between schemes rather than using the brand green", () => {
    // Web's primary button is near-black on light and near-white on dark. The scaffold used a
    // mint green that appears nowhere in web — this asserts the actual relationship.
    expect(palettes.light.cta).toBe(palettes.dark.ctaFg);
    expect(palettes.light.ctaFg).toBe("#ffffff");
    expect(palettes.dark.cta).toBe("#f0f0f0");
    expect(palettes.light.cta).not.toBe(accents.brand);
  });

  it("light and dark define the same token set", () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it("greenSoft and greenHi give Piso's body/line a working pair in both schemes", () => {
    // Added for TEN-434: `accents.brand` (#1f8a5b) was the only green on hand when Piso's body
    // needed a pale mint, and #003c33-on-#1f8a5b measures 2.86:1 — below AA even for large text,
    // nowhere close to a line drawing's needs. `greenHi` was already scheme-aware; `greenSoft`
    // is its missing body-fill partner. Light's dark line (`greenHi`) is exactly dark's own body
    // fill (`greenSoft`) — both #003c33 — but light's body (`greenSoft`) and dark's line
    // (`greenHi`) are two different pale tones, not a mirror swap: each scheme's pair was chosen
    // for its own background, not derived from the other's.
    expect(palettes.light.greenHi).toBe(palettes.dark.greenSoft);
    expect(palettes.light.greenHi).toBe("#003c33");
    expect(palettes.light.greenSoft).toBe("#9fe3c9");
    expect(palettes.dark.greenHi).toBe("#7fd6b8");
  });
});

/**
 * Before this scale existed, every text size in `ui.tsx` was a per-component literal (32, 30, 13,
 * 12.5, 11, ...) with no shared vocabulary between them. This pins the scale's shape so a future
 * "just add 14.5 inline" regresses here instead of silently widening the set again.
 */
describe("fontSizes", () => {
  it("is declared largest-first and strictly decreases through every step", () => {
    const steps = Object.values(fontSizes);
    expect(steps.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeLessThan(steps[i - 1]);
    }
  });

  it("has no duplicate step values", () => {
    const steps = Object.values(fontSizes);
    expect(new Set(steps).size).toBe(steps.length);
  });
});
