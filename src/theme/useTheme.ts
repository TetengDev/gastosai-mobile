import { useColorScheme } from "react-native";
import { accents, fonts, palettes, radii, spacing, type Palette } from "./index";

export interface Theme {
  scheme: "light" | "dark";
  colors: Palette & typeof accents;
  fonts: typeof fonts;
  radii: typeof radii;
  spacing: typeof spacing;
}

/**
 * Resolves the active theme from the device colour scheme.
 *
 * Web reads `prefers-color-scheme` and stores a manual override in `localStorage`; this follows
 * the same signal. A manual override is deliberately **not** included here — on a phone that
 * belongs with a Settings toggle, which is a separate change with its own persistence question.
 *
 * `useColorScheme()` can return null before the platform reports one; treating that as light
 * matches web, whose `:root` is the light palette.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return {
    scheme,
    colors: { ...palettes[scheme], ...accents },
    fonts,
    radii,
    spacing,
  };
}
