import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  aiLanguagePatch,
  DEFAULT_AI_LANGUAGE,
  fetchAiLanguages,
  languageLabel,
  languageOptionsFor,
  resolveAiLanguage,
} from "./aiSettings";

// babel-jest hoists this `jest.mock` above the import above it, so `aiSettings` gets the mock
// rather than a real axios instance that would try to reach the network. The `mock` prefix on the
// spy is what lets the factory close over it — jest rejects any other name there.
const mockGet = jest.fn();
jest.mock("./client", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
  API_BASE_URL: "http://api.test",
}));

/**
 * The settings screen renders whatever these functions return and sends whatever
 * `aiLanguagePatch` builds, so they are the real coverage for the picker: one fetches the
 * options, two decide what is shown, and the last decides what is written.
 */

describe("fetchAiLanguages", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("returns the languages the server offers, in order", async () => {
    mockGet.mockResolvedValue({
      data: [
        { code: "en", displayName: "English" },
        { code: "ja", displayName: "日本語" },
      ],
    } as never);

    await expect(fetchAiLanguages()).resolves.toEqual([
      { code: "en", displayName: "English" },
      { code: "ja", displayName: "日本語" },
    ]);
  });

  it("reads the unversioned surface, where the contract publishes the endpoint", async () => {
    // `/api/v2` does not mirror `/ai/languages`; the client's versioned base would 404.
    mockGet.mockResolvedValue({ data: [] } as never);

    await fetchAiLanguages();

    expect(mockGet.mock.calls[0]).toEqual(["/ai/languages", { baseURL: "http://api.test" }]);
  });

  it("falls back to English alone when the call fails", async () => {
    // A settings screen with no language control at all is worse than one offering the default.
    mockGet.mockRejectedValue(new Error("network") as never);

    await expect(fetchAiLanguages()).resolves.toEqual([
      { code: DEFAULT_AI_LANGUAGE, displayName: "English" },
    ]);
  });
});

describe("resolveAiLanguage", () => {
  it("keeps a stored language", () => {
    expect(resolveAiLanguage("fil")).toBe("fil");
    expect(resolveAiLanguage("en")).toBe("en");
  });

  it("falls back to the default when nothing is stored", () => {
    // The backend sends null until the user picks one; the control must still show a selection,
    // and the default is what the API itself would use.
    expect(resolveAiLanguage(null)).toBe(DEFAULT_AI_LANGUAGE);
    expect(resolveAiLanguage(undefined)).toBe(DEFAULT_AI_LANGUAGE);
    expect(resolveAiLanguage("")).toBe(DEFAULT_AI_LANGUAGE);
    expect(resolveAiLanguage("   ")).toBe(DEFAULT_AI_LANGUAGE);
  });

  it("keeps a code this build has never heard of", () => {
    // The allow-list is the server's now. A code chosen from web, or added after this build
    // shipped (CLAUDE.md §1.5), is a real setting — reporting it as English would be a lie.
    expect(resolveAiLanguage("zh-Hans")).toBe("zh-Hans");
  });
});

describe("languageOptionsFor", () => {
  const offered = [
    { code: "en", displayName: "English" },
    { code: "fil", displayName: "Filipino" },
  ];

  it("leaves the list alone when the stored code is offered", () => {
    expect(languageOptionsFor(offered, "fil")).toEqual(offered);
  });

  it("appends a stored code the server no longer offers, so it stays visible", () => {
    expect(languageOptionsFor(offered, "ja")).toEqual([...offered, { code: "ja", displayName: "ja" }]);
  });
});

describe("languageLabel", () => {
  it("names a language the server offers", () => {
    expect(languageLabel([{ code: "ja", displayName: "日本語" }], "ja")).toBe("日本語");
  });

  it("falls back to the raw code for anything else", () => {
    expect(languageLabel([], "zh-Hans")).toBe("zh-Hans");
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
