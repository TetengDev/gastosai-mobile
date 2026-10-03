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
  /**
   * Pale mint for a body fill (Piso, TEN-434) — not a text colour, so it doesn't belong beside
   * `text`/`text2`/`text3` above. `accents.brand` was the only green on hand when this was
   * needed and is nowhere near light enough: `greenHi` on `brand` is 2.86:1, below AA even for
   * large text. Light's `greenHi` (the line) equals dark's `greenSoft` (the body) — both
   * `#003c33` — but each scheme's own pair was picked for its own background, not derived by
   * mirroring the other scheme's values.
   */
  greenSoft: string;
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
  greenSoft: "#003c33",
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

/**
 * Text size scale, derived from the literals `ui.tsx` already used rather than a fresh ramp —
 * those values encode real decisions (a mono micro-label reads fine at 11; a stat value wants
 * 32). Declared largest to smallest; `theme.test.ts` pins that it stays monotonic and that no
 * two steps collapse to the same number, so a future "just add 14.5 inline" has to touch this
 * file instead of quietly growing the set it replaced.
 *
 * Named by role, not by number, and `ui.tsx` reads these rather than writing a size itself:
 * - `display` — the one hero figure on a screen (`StatTile`'s value).
 * - `heading` — a screen's title, and the `FloatingAddButton` glyph (same literal, 30, as the
 *   title it visually matches).
 * - `content` — the size of the thing being interacted with: a field's typed text, a list row's
 *   label, the month stepper's label.
 * - `body` — paragraph copy: `Body`, a page subtitle, the search field's placeholder.
 * - `control` — supporting UI copy: button labels, error and paywall text.
 * - `caption` — secondary small text. Merges the two literals that were 0.5px apart and played
 *   the same role (`StatTile`'s sub-line, `ListRow`'s sub-line, `Field`/`Pill` labels, the small
 *   button variant) — 12.5 was never a deliberate step down from 13, just two authors reaching
 *   for "small" independently.
 * - `micro` — the uppercase, tracked mono label, and the one-line badge count.
 *
 * Icon sizes (`Ionicons`' `size` prop — 16, 17, 19, 20, 21 in `ui.tsx`) are a separate axis from
 * typography and are left as component literals; this scale is about text.
 */
export const fontSizes = {
  display: 32,
  heading: 30,
  content: 16,
  body: 15,
  control: 14,
  caption: 13,
  micro: 11,
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
