import { api, API_BASE_URL } from "./client";
import type { components } from "./generated/schema";

type Schemas = components["schemas"];

/**
 * The two AI languages live on the account, not on the device: `/user/ai-settings` stores which
 * language the insight cards are written in and which one the assistant replies in. They are read
 * and written by the same endpoint and are **independent** — a save sends only the field that
 * changed, because an omitted field leaves the stored value alone.
 *
 * Nothing here is derivation: the languages are chosen by the user, the set of allowed values is
 * the server's (`GET /ai/languages`), and both are applied server-side when the text is generated
 * (CLAUDE.md §1.2). This module only fetches the options and shapes the two requests.
 */

/**
 * A language the server offers for AI prose.
 *
 * The set is configuration-driven on the backend and served by `GET /ai/languages`, so `code` is
 * the contract's bare string: there is no local union to keep in step with it, which is the point.
 * Derived from the generated schema rather than written out, so a renamed field breaks the build
 * (CONTRACT.md); `Required` puts back the presence springdoc drops — the endpoint always sends
 * both properties.
 */
export type AiLanguageOption = Required<Schemas["AiLanguageOption"]>;

/** What the API uses for a user who has not chosen a language. */
export const DEFAULT_AI_LANGUAGE = "en";

/**
 * What the picker falls back to, so a failed call still leaves a usable control — and what it
 * shows before the options arrive. Exported so the card does not keep a second copy of it.
 */
export const ENGLISH_ONLY: AiLanguageOption[] = [
  { code: DEFAULT_AI_LANGUAGE, displayName: "English" },
];

/**
 * The picker's options, in the order the server gives. A failed call returns English alone rather
 * than throwing: a settings screen that cannot render its language control is worse than one
 * offering only the default.
 *
 * The contract publishes this at `/ai/languages` and nowhere else — `/api/v2` does not mirror it —
 * so it is read from the unversioned surface, like `/ai/chat/confirm`. Nothing money-bearing
 * crosses it: a code and a name.
 */
export const fetchAiLanguages = async (): Promise<AiLanguageOption[]> => {
  try {
    const { data } = await api.get<AiLanguageOption[]>("/ai/languages", {
      baseURL: API_BASE_URL,
    });
    return data;
  } catch {
    return ENGLISH_ONLY;
  }
};

/** Which of the two settings a control writes. */
export type AiLanguageField = "insight" | "chat";

/**
 * springdoc marks every response property optional; the two languages are additionally sent as
 * `null` until the user picks one, which the generated type cannot express.
 */
export type AiSettings = Omit<
  Schemas["AiSettingsResponse"],
  "insightLanguage" | "chatLanguage"
> & {
  insightLanguage?: string | null;
  chatLanguage?: string | null;
};

/**
 * Derived from the contract's request shape so a renamed field breaks the build rather than
 * silently posting a key the backend ignores. Mobile never sends the API-key fields — keys are
 * entered on web — but they stay in the type because they are part of the same request.
 */
export type AiSettingsUpdate = Omit<
  Schemas["AiSettingsRequest"],
  "insightLanguage" | "chatLanguage"
> & {
  insightLanguage?: string;
  chatLanguage?: string;
};

export const getAiSettings = () => api.get<AiSettings>("/user/ai-settings").then((r) => r.data);

export const updateAiSettings = (body: AiSettingsUpdate) =>
  api.put<AiSettings>("/user/ai-settings", body).then((r) => r.data);

/**
 * What the picker should show for a stored value. `null` and blank are the unset cases and mean
 * the default, which is what the API itself would use. Any other code is kept verbatim: the
 * allow-list now lives on the server, so a code this build has never heard of is a language the
 * user really chose — from web, or from a newer build — and replacing it with English here would
 * misreport their setting. `languageOptionsFor` is what makes such a code renderable.
 */
export const resolveAiLanguage = (value: string | null | undefined): string =>
  value?.trim() ? value : DEFAULT_AI_LANGUAGE;

/**
 * The options a control must offer to be able to show `current`.
 *
 * A stored code the server no longer offers — or one added after this build shipped — must not
 * silently select something else: it is appended, labelled with its raw code, so the user can see
 * what is stored and change it.
 */
export const languageOptionsFor = (
  options: AiLanguageOption[],
  current: string,
): AiLanguageOption[] =>
  options.some((o) => o.code === current)
    ? options
    : [...options, { code: current, displayName: current }];

/** The name to show for a stored code, falling back to the code itself. */
export const languageLabel = (options: AiLanguageOption[], code: string): string =>
  options.find((o) => o.code === code)?.displayName ?? code;

/**
 * The body for changing one language. Sending only the changed field is what keeps the two
 * settings independent: a PUT carrying both would overwrite the other control's value with
 * whatever this screen last read, which is wrong the moment the two were changed from different
 * devices.
 */
export const aiLanguagePatch = (field: AiLanguageField, value: string): AiSettingsUpdate =>
  field === "insight" ? { insightLanguage: value } : { chatLanguage: value };
