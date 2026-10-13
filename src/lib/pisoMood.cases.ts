import type { PisoMoodInput } from "./pisoMood";
import type { PisoState } from "../brand/Piso";

/**
 * The mood map from the Piso redesign spec, §2, as data. Web and mobile run this exact table, so
 * the two platforms cannot disagree about what Piso feels. Only the import above differs between
 * the two copies.
 */
export const PISO_MOOD_CASES: ReadonlyArray<readonly [string, PisoMoodInput, PisoState]> = [
  ["no budgets and no expenses is empty", { bands: [], hasExpenses: false }, "empty"],
  ["no budgets but some expenses rests", { bands: [], hasExpenses: true }, "resting"],
  ["budgets but no expenses yet rests", { bands: ["ON_TRACK"], hasExpenses: false }, "resting"],
  ["every line on track rests", { bands: ["ON_TRACK", "ON_TRACK"], hasExpenses: true }, "resting"],
  ["one warning line worries", { bands: ["ON_TRACK", "WARNING"], hasExpenses: true }, "worried"],
  [
    "one over line beats a warning",
    { bands: ["WARNING", "OVER_BUDGET", "ON_TRACK"], hasExpenses: true },
    "overBudget",
  ],
  ["saved beats over budget", { bands: ["OVER_BUDGET"], hasExpenses: true, saved: true }, "saved"],
  ["saved beats empty", { bands: [], hasExpenses: false, saved: true }, "saved"],
  [
    "cheer beats saved",
    { bands: ["OVER_BUDGET"], hasExpenses: true, saved: true, cheer: true },
    "cheer",
  ],
  [
    "thinking beats everything",
    { bands: ["OVER_BUDGET"], hasExpenses: true, saved: true, cheer: true, thinking: true },
    "thinking",
  ],
];
