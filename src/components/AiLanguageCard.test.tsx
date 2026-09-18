import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AiLanguageCard } from "./AiLanguageCard";
import type { AiSettings, AiSettingsUpdate } from "../api/aiSettings";

/**
 * The first render test in the repo, and the worked example for the rest (TEN-387).
 *
 * `aiSettings` is mocked only at its three network-touching functions: `getAiSettings`,
 * `fetchAiLanguages` and `updateAiSettings`. Everything else — `aiLanguagePatch`,
 * `languageOptionsFor`, `languageLabel`, `resolveAiLanguage` — stays real, so what this file
 * asserts is the component's own branching over the real helpers, not a second copy of the logic
 * already covered in `src/api/aiSettings.test.ts`.
 *
 * The control under test is a row that opens a `Modal` + `FlatList` sheet of every language the
 * server publishes (TEN-390), not the two pills it was when TEN-381 shipped — so choosing a
 * language is two presses, and the sheet's options carry the same `ai-language-<setting>-<code>`
 * ids the pills did.
 */

const mockGetAiSettings = jest.fn<() => Promise<AiSettings>>();
const mockFetchAiLanguages = jest.fn<() => Promise<{ code: string; displayName: string }[]>>();
const mockUpdateAiSettings = jest.fn<(body: AiSettingsUpdate) => Promise<AiSettings>>();

jest.mock("../api/aiSettings", () => ({
  ...(jest.requireActual("../api/aiSettings") as object),
  getAiSettings: () => mockGetAiSettings(),
  fetchAiLanguages: () => mockFetchAiLanguages(),
  updateAiSettings: (body: AiSettingsUpdate) => mockUpdateAiSettings(body),
}));

const SETTINGS: AiSettings = { insightLanguage: "en", chatLanguage: "en" };

const LANGUAGES = [
  { code: "en", displayName: "English" },
  { code: "fil", displayName: "Filipino" },
  { code: "ja", displayName: "日本語" },
];

let client: QueryClient;

function renderCard() {
  // `retry: false` so a rejected query fails the first time rather than after three backed-off
  // attempts, which would outlive the test. `gcTime: 0` so an unmounted query leaves no five
  // minute collection timer behind — jest reports that as a run that will not exit.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<AiLanguageCard />, { wrapper });
}

beforeEach(() => {
  mockGetAiSettings.mockReset();
  mockFetchAiLanguages.mockReset();
  mockUpdateAiSettings.mockReset();
  mockFetchAiLanguages.mockResolvedValue(LANGUAGES);
});

afterEach(() => {
  // RNTL's own `afterEach` unmounts the tree; this drops what the cache still holds for it.
  client?.clear();
});

describe("AiLanguageCard", () => {
  it("shows a placeholder and no language while the settings are loading", () => {
    // Never resolves: the card is held in its loading branch for the whole test.
    mockGetAiSettings.mockReturnValue(new Promise(() => {}));

    const { toJSON } = renderCard();

    // The skeleton has no text of its own, so the assertion is what it is standing in for:
    // neither the card's heading nor either row is on screen yet. Showing a row early would
    // show a language the user has not been told is still being read.
    expect(screen.queryByText("AI language")).toBeNull();
    expect(screen.queryByTestId("ai-language-insights-row")).toBeNull();
    expect(screen.queryByTestId("ai-language-assistant-row")).toBeNull();
    expect(toJSON()).toHaveStyle({ height: 200 });
  });

  it("reports a failed load instead of showing a language nobody chose", async () => {
    mockGetAiSettings.mockRejectedValue(new Error("boom"));

    renderCard();

    expect(await screen.findByText("Failed to load AI language settings.")).toBeOnTheScreen();
    // The rows are the part that must not appear: a stored value that failed to load would
    // otherwise render as the default and misreport the account's setting.
    expect(screen.queryByTestId("ai-language-insights-row")).toBeNull();
    expect(mockUpdateAiSettings).not.toHaveBeenCalled();
  });

  it("offers every language the server publishes, not a built-in pair", async () => {
    mockGetAiSettings.mockResolvedValue(SETTINGS);
    const user = userEvent.setup();

    renderCard();

    await user.press(await screen.findByTestId("ai-language-insights-row"));

    for (const language of LANGUAGES) {
      expect(screen.getByTestId(`ai-language-insights-${language.code}`)).toBeOnTheScreen();
    }
  });

  it("sends only the field the chosen language belongs to", async () => {
    mockGetAiSettings.mockResolvedValue(SETTINGS);
    mockUpdateAiSettings.mockResolvedValue({ insightLanguage: "fil", chatLanguage: "en" });
    const user = userEvent.setup();

    renderCard();

    await user.press(await screen.findByTestId("ai-language-insights-row"));
    await user.press(screen.getByTestId("ai-language-insights-fil"));

    // Not `{ insightLanguage: "fil", chatLanguage: "en" }`: a PUT carrying both would overwrite
    // the assistant's language with whatever this screen last read.
    expect(mockUpdateAiSettings).toHaveBeenCalledTimes(1);
    expect(mockUpdateAiSettings).toHaveBeenCalledWith({ insightLanguage: "fil" });
  });

  it("writes the assistant's own field from the assistant row", async () => {
    mockGetAiSettings.mockResolvedValue(SETTINGS);
    mockUpdateAiSettings.mockResolvedValue({ insightLanguage: "en", chatLanguage: "ja" });
    const user = userEvent.setup();

    renderCard();

    await user.press(await screen.findByTestId("ai-language-assistant-row"));
    await user.press(screen.getByTestId("ai-language-assistant-ja"));

    expect(mockUpdateAiSettings).toHaveBeenCalledWith({ chatLanguage: "ja" });
  });

  it("does not write when the language chosen is the one already stored", async () => {
    mockGetAiSettings.mockResolvedValue(SETTINGS);
    const user = userEvent.setup();

    renderCard();

    await user.press(await screen.findByTestId("ai-language-insights-row"));
    await user.press(screen.getByTestId("ai-language-insights-en"));

    expect(mockUpdateAiSettings).not.toHaveBeenCalled();
    // The sheet still closes, so the tap is not silently swallowed.
    expect(screen.queryByTestId("ai-language-insights-fil")).toBeNull();
  });
});
