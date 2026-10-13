import type { PisoState } from "../brand/Piso";

/** The server's budget banding. A client reads it and never re-derives it from `percentUsed`. */
export type BudgetBand = "ON_TRACK" | "WARNING" | "OVER_BUDGET";
export type GoalStatus = "ON_TRACK" | "BEHIND" | "COMPLETED" | "PAUSED";
export type MeterTone = "onTrack" | "warning" | "over" | "goal" | "paused";

export interface PisoMoodInput {
  /** The server's status for each budget line on screen. */
  bands: readonly BudgetBand[];
  hasExpenses: boolean;
  thinking?: boolean;
  cheer?: boolean;
  saved?: boolean;
}

const BANDS: readonly BudgetBand[] = ["ON_TRACK", "WARNING", "OVER_BUDGET"];

/** The summary endpoint types `status` as a bare string; anything unrecognised reads as on track. */
export function toBand(status: string | null | undefined): BudgetBand {
  return BANDS.find((b) => b === status) ?? "ON_TRACK";
}

export function worstBand(bands: readonly BudgetBand[]): BudgetBand | null {
  let worst: BudgetBand | null = null;
  for (const band of bands) {
    if (worst === null || BANDS.indexOf(band) > BANDS.indexOf(worst)) worst = band;
  }
  return worst;
}

/** Spec §2: thinking > cheer > saved > empty > the worst budget band. */
export function pisoMoodFor(input: PisoMoodInput): PisoState {
  if (input.thinking) return "thinking";
  if (input.cheer) return "cheer";
  if (input.saved) return "saved";
  if (input.bands.length === 0 && !input.hasExpenses) return "empty";
  const worst = worstBand(input.bands);
  if (worst === "OVER_BUDGET") return "overBudget";
  if (worst === "WARNING") return "worried";
  return "resting";
}

export function budgetTone(status: BudgetBand): MeterTone {
  if (status === "OVER_BUDGET") return "over";
  if (status === "WARNING") return "warning";
  return "onTrack";
}

/** A goal is good news as it fills, so it never bands like a budget. */
export function goalTone(status: GoalStatus): MeterTone {
  if (status === "PAUSED") return "paused";
  if (status === "BEHIND") return "warning";
  return "goal";
}
