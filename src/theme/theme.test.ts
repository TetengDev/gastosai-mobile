import { describe, expect, it } from "@jest/globals";
import { accents, palettes } from "./index";

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
      text2: "#75758a",
      text3: "#93939f",
      inputBg: "#ffffff",
      cta: "#17171c",
      ctaFg: "#ffffff",
      greenHi: "#003c33",
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
});
