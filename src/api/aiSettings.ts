import { api } from "./client";
import type { components } from "./generated/schema";

type Schemas = components["schemas"];

/**
 * The two AI languages live on the account, not on the device: `/user/ai-settings` stores which
 * language the insight cards are written in and which one the assistant replies in. They are read
 * and written by the same endpoint and are **independent** — a save sends only the field that
 * changed, because an omitted field leaves the stored value alone.
 *
 * Nothing here is derivation: the languages are chosen by the user and applied server-side when
 * the text is generated (CLAUDE.md §1.2). This module only names the allowed values and shapes
 * the two requests.
 */

/**
 * The contract types both language fields as bare `string` — the backend's `AiLanguage`
 * allow-list is not expressed in the spec, though it is closed on the server (anything else is a
 * 400). The domain is stated here so the picker cannot offer a value the API would reject.
 */
export type AiLanguage = "en" | "fil";

/** What the API uses for a user who has not chosen a language. */
export const DEFAULT_AI_LANGUAGE: AiLanguage = "en";

export const AI_LANGUAGES: { code: AiLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fil", label: "Filipino" },
];

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
  insightLanguage?: AiLanguage;
  chatLanguage?: AiLanguage;
};

export const getAiSettings = () => api.get<AiSettings>("/user/ai-settings").then((r) => r.data);

export const updateAiSettings = (body: AiSettingsUpdate) =>
  api.put<AiSettings>("/user/ai-settings", body).then((r) => r.data);

/**
 * What the picker should show for a stored value. `null` is the unset case, and an unrecognised
 * code — a language a newer backend offers that this installed build does not list — falls back
 * to the default rather than leaving the control with nothing selected. Installed apps run old
 * versions for months (CLAUDE.md §1.5), so that case is real rather than theoretical.
 */
export const resolveAiLanguage = (value: string | null | undefined): AiLanguage =>
  AI_LANGUAGES.some((l) => l.code === value) ? (value as AiLanguage) : DEFAULT_AI_LANGUAGE;

/**
 * The body for changing one language. Sending only the changed field is what keeps the two
 * settings independent: a PUT carrying both would overwrite the other control's value with
 * whatever this screen last read, which is wrong the moment the two were changed from different
 * devices.
 */
export const aiLanguagePatch = (field: AiLanguageField, value: AiLanguage): AiSettingsUpdate =>
  field === "insight" ? { insightLanguage: value } : { chatLanguage: value };
