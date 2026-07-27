/**
 * Design tokens, ported verbatim from `gastosai-web/src/index.css` (`:root` and `.dark`).
 *
 * These values are copied, not approximated. The point of this file is that the two products
 * look like one product — a "close enough" hex here is the whole problem it exists to solve.
 * `src/theme/theme.test.ts` asserts the exact values so a typo cannot slip through unnoticed.
 *
 * Polyrepo rule: the *approach* is shared with web, the code is not. There is no runtime
 * dependency between the repos (CONTRACT.md).
 */

export interface Palette {
  page: string;
  surface: string;
  surface2: string;
  /** Warm panel — budget overview and similar emphasis blocks. */
  surface3: string;
  surface4: string;
  track: string;
  border: string;
  border2: string;
  border3: string;
  borderInput: string;
  textHi: string;
  text: string;
  text2: string;
  text3: string;
  inputBg: string;
  /** Primary action. Near-black on light, near-white on dark — deliberately not the brand green. */
  cta: string;
  ctaFg: string;
  greenHi: string;
  warnBg: string;
  warnBorder: string;
  warnText: string;
}

const light: Palette = {
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
};

const dark: Palette = {
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
};

export const palettes = { light, dark } as const;

/** Constant across both schemes, exactly as in web's `@theme` block. */
export const accents = {
  brand: "#1f8a5b",
  hero: "#003c33",
  link: "#1863dc",
  alert: "#ff7759",
  amber: "#e8590c",
  /** Web's danger button colour. */
  danger: "#b30000",
} as const;

/**
 * Font families. Names must match what `useFonts` registers in `app/_layout.tsx`.
 *
 * Roles mirror web: Space Grotesk for headings and numeric values, Hanken Grotesk for body,
 * Space Mono for the uppercase micro-labels that give the dashboard its character.
 */
export const fonts = {
  display: "SpaceGrotesk_500Medium",
  displayBold: "SpaceGrotesk_700Bold",
  body: "HankenGrotesk_400Regular",
  bodyMedium: "HankenGrotesk_500Medium",
  bodySemi: "HankenGrotesk_600SemiBold",
  mono: "SpaceMono_400Regular",
} as const;

/** Shape and spacing, matching web's Tailwind usage. */
export const radii = {
  /** `rounded-2xl` — cards. */
  card: 16,
  /** `rounded-full` — buttons and pills. */
  pill: 999,
  input: 10,
} as const;

export const spacing = {
  /** Card padding — web uses `p-7` (28px). Trimmed to 20 on phones, where 28 wastes width. */
  card: 20,
  screen: 20,
  gap: 16,
} as const;
