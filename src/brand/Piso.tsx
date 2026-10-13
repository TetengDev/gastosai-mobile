import { Circle, Ellipse, Path, Rect, Svg } from "react-native-svg";
import { useTheme } from "../theme/useTheme";

/**
 * Piso: a bamboo alkansya (coin bank) — a vertical bamboo tube with a coin slot. Not an animal,
 * no face beyond the line drawing below. The artwork is settled and provisional by the user's own
 * decision: this is not the place to redesign it, make it a pig, or add ears, a snout or a peso
 * glyph.
 *
 * Mirrors the web component being built in parallel: same five states, same 32px mark/face
 * threshold, same rule that Piso is never the only signal for a state — the text next to it always
 * stays. There is deliberately no motion here: no Reanimated, no Animated, nothing. If a later
 * change makes this animate, it is a different issue.
 *
 * All colours come from `src/theme/index.ts` via `useTheme()`, never hardcoded, so this keeps
 * working if dark mode ever reaches mobile (today the app renders light only). The five roles the
 * brief names map onto the palette like this:
 * - body mint → `colors.greenSoft` — added for this issue (TEN-434 review): `accents.brand`
 *   (#1f8a5b) was the stand-in, and `greenHi`-on-`brand` measures 2.86:1, below AA even for large
 *   text. `greenSoft` gives 8.44:1 in light, ~7.3:1 in dark.
 * - line deep green → `colors.greenHi`, not `colors.hero`. `hero` is the right call for a line
 *   drawn on a fixed background, but the body now flips with the scheme too (light's `greenHi`
 *   is dark's `greenSoft` and vice versa), so the line has to flip with it — `greenHi` is the
 *   scheme-aware half of that pair.
 * - warm panel → `colors.surface3` — the same warm panel `Card`'s `tone="panel"` uses elsewhere.
 * - amber background / amber foreground → `colors.warnBg` / `colors.warnText` — the app's
 *   existing warning pair, reused here rather than inventing a second amber. This is the
 *   `overBudget` recolour, not the coin below.
 *
 * The coin (`saved`) is gold: `colors.warnBorder` fill, `colors.warnText` stroke — both already
 * existing tokens, no new one needed. An earlier version of this file used `colors.amber`
 * (#e8590c), a vivid orange that reads as an alert rather than a peso coin; `warnBorder` is the
 * same family at a gold weight instead. The three thinking dots stay on the line colour
 * (`greenHi`, via the `line` variable below) — not `colors.amber` either, which a stale version
 * of this comment once claimed while the code already used the line colour correctly.
 */
export type PisoState = "resting" | "saved" | "empty" | "overBudget" | "thinking";

const STATE_LABEL: Partial<Record<PisoState, string>> = {
  saved: "Expense saved",
  overBudget: "Over budget",
  thinking: "Thinking",
};

/** Below this, a scaled-down face would be illegible — render the faceless mark instead. */
const MARK_THRESHOLD = 32;

export function Piso({
  state = "resting",
  size = 96,
  testID,
}: {
  state?: PisoState;
  size?: number;
  testID?: string;
}) {
  const t = useTheme();

  const overBudget = state === "overBudget";
  const bodyFill = overBudget
    ? t.colors.warnBg
    : state === "empty"
      ? t.colors.surface3
      : t.colors.greenSoft;
  const line = overBudget ? t.colors.warnText : t.colors.greenHi;

  const announced = STATE_LABEL[state];
  const accessibilityProps = announced
    ? {
        accessible: true as const,
        accessibilityRole: "image" as const,
        accessibilityLabel: announced,
      }
    : {
        accessibilityElementsHidden: true as const,
        importantForAccessibility: "no-hide-descendants" as const,
      };

  if (size < MARK_THRESHOLD) {
    return (
      <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" {...accessibilityProps}>
        <Rect x={5} y={3} width={14} height={18} rx={4} fill={bodyFill} stroke={line} strokeWidth={2} />
        <Path d="M5 10h14" stroke={line} strokeWidth={2} strokeLinecap="round" />
        <Rect x={9} y={5.6} width={6} height={2} rx={1} fill={line} />
      </Svg>
    );
  }

  const mouth = {
    resting: "M57 77q7 5 14 0",
    thinking: "M57 77q7 5 14 0",
    saved: "M54 76q10 7 20 0",
    empty: "M57 78h14",
    overBudget: "M57 80q7-5 14 0",
  }[state];

  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 128 128" {...accessibilityProps}>
      <Ellipse cx={64} cy={117} rx={30} ry={4} fill={t.colors.hero} opacity={0.12} />
      <Rect x={28} y={20} width={72} height={94} rx={18} fill={bodyFill} stroke={line} strokeWidth={4.5} />
      <Path d="M28 54h72M28 84h72" stroke={line} strokeWidth={4.5} strokeLinecap="round" />
      <Rect x={50} y={31} width={28} height={7} rx={3.5} fill={line} />

      {state === "saved" ? (
        <>
          <Circle
            cx={64}
            cy={12}
            r={9}
            fill={t.colors.warnBorder}
            stroke={t.colors.warnText}
            strokeWidth={3}
          />
          <Path d="M47 69q5-6 10 0" stroke={line} strokeWidth={3.6} fill="none" strokeLinecap="round" />
          <Path d="M71 69q5-6 10 0" stroke={line} strokeWidth={3.6} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={52} cy={68} r={4.2} fill={line} />
          <Circle cx={76} cy={68} r={4.2} fill={line} />
        </>
      )}

      {state === "overBudget" ? (
        <Path d="M90 88l-8 10 7 3-6 9" stroke={line} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      ) : null}

      {state === "thinking" ? (
        <>
          <Circle cx={46} cy={11} r={5} fill={line} opacity={0.35} />
          <Circle cx={64} cy={11} r={5} fill={line} opacity={0.6} />
          <Circle cx={82} cy={11} r={5} fill={line} opacity={1} />
        </>
      ) : null}

      <Path d={mouth} stroke={line} strokeWidth={3.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
