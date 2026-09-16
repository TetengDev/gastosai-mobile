import { describe, expect, it } from "@jest/globals";
import {
  aiLanguagePatch,
  AI_LANGUAGES,
  DEFAULT_AI_LANGUAGE,
  resolveAiLanguage,
} from "./aiSettings";

/**
 * The settings screen renders whatever `resolveAiLanguage` returns and sends whatever
 * `aiLanguagePatch` builds, so these two functions are the real coverage for the picker: one
 * decides what is selected, the other decides what is written.
 */

describe("resolveAiLanguage", () => {
  it("keeps a stored language the app knows", () => {
    expect(resolveAiLanguage("fil")).toBe("fil");
    expect(resolveAiLanguage("en")).toBe("en");
  });

  it("falls back to the default when nothing is stored", () => {
    // The backend sends null until the user picks one; the control must still show a selection,
    // and the default is what the API itself would use.
    expect(resolveAiLanguage(null)).toBe(DEFAULT_AI_LANGUAGE);
    expect(resolveAiLanguage(undefined)).toBe(DEFAULT_AI_LANGUAGE);
  });

  it("falls back for a language this build does not list", () => {
    // An installed app runs for months against a newer backend (CLAUDE.md §1.5). A code added
    // after this release must not leave the picker with no selected option.
    expect(resolveAiLanguage("es")).toBe(DEFAULT_AI_LANGUAGE);
    expect(resolveAiLanguage("")).toBe(DEFAULT_AI_LANGUAGE);
  });
});

describe("aiLanguagePatch", () => {
  it("sends only the insight language when insights change", () => {
    expect(aiLanguagePatch("insight", "fil")).toEqual({ insightLanguage: "fil" });
  });

  it("sends only the chat language when the assistant changes", () => {
    expect(aiLanguagePatch("chat", "en")).toEqual({ chatLanguage: "en" });
  });

  it("never carries the other field, so the two settings stay independent", () => {
    // A body carrying both would overwrite the setting the user did not touch.
    expect(Object.keys(aiLanguagePatch("insight", "en"))).toEqual(["insightLanguage"]);
    expect(Object.keys(aiLanguagePatch("chat", "fil"))).toEqual(["chatLanguage"]);
  });
});

describe("AI_LANGUAGES", () => {
  it("offers the default as one of its options", () => {
    // A default missing from the list would resolve to itself and render as an empty control.
    expect(AI_LANGUAGES.map((l) => l.code)).toContain(DEFAULT_AI_LANGUAGE);
  });
});
