import { describe, expect, it } from "@jest/globals";
import { budgetTone, goalTone, pisoMoodFor, toBand, worstBand } from "./pisoMood";
import { PISO_MOOD_CASES } from "./pisoMood.cases";

describe("pisoMoodFor", () => {
  it.each(PISO_MOOD_CASES)("%s", (_name, input, expected) => {
    expect(pisoMoodFor(input)).toBe(expected);
  });
});

describe("worstBand", () => {
  it("is null with no lines", () => expect(worstBand([])).toBeNull());
  it("ranks over above warning above on track", () => {
    expect(worstBand(["ON_TRACK", "WARNING"])).toBe("WARNING");
    expect(worstBand(["OVER_BUDGET", "WARNING"])).toBe("OVER_BUDGET");
  });
});

describe("toBand", () => {
  it.each(["ON_TRACK", "WARNING", "OVER_BUDGET"] as const)("keeps %s", (s) => {
    expect(toBand(s)).toBe(s);
  });
  it.each([undefined, null, "", "SOMETHING_NEW"])("reads %s as ON_TRACK", (s) => {
    expect(toBand(s)).toBe("ON_TRACK");
  });
});

describe("tones", () => {
  it("maps every budget band", () => {
    expect(budgetTone("ON_TRACK")).toBe("onTrack");
    expect(budgetTone("WARNING")).toBe("warning");
    expect(budgetTone("OVER_BUDGET")).toBe("over");
  });
  it("maps every goal status, and a goal never reads as over", () => {
    expect(goalTone("ON_TRACK")).toBe("goal");
    expect(goalTone("COMPLETED")).toBe("goal");
    expect(goalTone("BEHIND")).toBe("warning");
    expect(goalTone("PAUSED")).toBe("paused");
  });
});
