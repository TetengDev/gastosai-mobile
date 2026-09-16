import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import {
  aiLanguagePatch,
  AI_LANGUAGES,
  getAiSettings,
  resolveAiLanguage,
  updateAiSettings,
  type AiLanguage,
  type AiLanguageField,
} from "../api/aiSettings";
import { errorMessage } from "../api/client";
import { Body, Card, ErrorText, Pill, Skeleton } from "./ui";

/**
 * The two AI languages, in the platform's own idiom: web shows a pair of `<select>` dropdowns,
 * which on a phone would be a wheel picker for a two-item list. A row of tappable pills is the
 * same choice in one tap, with the current value visible without opening anything.
 *
 * Both read from and write to `/user/ai-settings`, and each writes only its own field — see
 * `aiLanguagePatch`. Saving is immediate: there is no Save button to leave un-pressed.
 */
function LanguageRow({
  label,
  hint,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  value: AiLanguage;
  disabled: boolean;
  onSelect: (value: AiLanguage) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Body>{label}</Body>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {AI_LANGUAGES.map((language) => (
          <Pill
            key={language.code}
            testID={`ai-language-${label.toLowerCase()}-${language.code}`}
            label={language.label}
            selected={language.code === value}
            // Always a button, even for the selected option and while a save is in flight: `Pill`
            // only reports `accessibilityState.selected` when it is pressable, so dropping the
            // handler would hide which language is chosen from VoiceOver and from the UI tree.
            // Re-selecting what is already stored is a no-op rather than a pointless request.
            onPress={() => {
              if (disabled || language.code === value) return;
              onSelect(language.code);
            }}
          />
        ))}
      </View>
      <Body dim style={{ fontSize: 12.5 }}>
        {hint}
      </Body>
    </View>
  );
}

export function AiLanguageCard() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings,
  });

  const save = useMutation({
    mutationFn: ({ field, value }: { field: AiLanguageField; value: AiLanguage }) =>
      updateAiSettings(aiLanguagePatch(field, value)),
    onSuccess: (settings) => {
      // The response is the whole record, so seed the cache with it rather than refetching.
      qc.setQueryData(["ai-settings"], settings);
      // Insight cards are generated text in the chosen language; cached copies are now stale.
      // Chat holds its replies in screen state, so the next message picks the new language up.
      qc.invalidateQueries({ queryKey: ["insight"] });
    },
  });

  if (isLoading) return <Skeleton height={200} />;

  // A failed load leaves nothing to select against — showing pills over an unknown stored value
  // would claim a setting the user never chose.
  if (isError) {
    return (
      <Card>
        <Body dim style={{ fontSize: 12.5 }}>
          AI language
        </Body>
        <ErrorText>{errorMessage(error, "Failed to load AI language settings.")}</ErrorText>
      </Card>
    );
  }

  const insight = resolveAiLanguage(data?.insightLanguage);
  const chat = resolveAiLanguage(data?.chatLanguage);

  return (
    <Card>
      <Body dim style={{ fontSize: 12.5 }}>
        AI language
      </Body>
      <LanguageRow
        label="Insights"
        hint="The language of the insight cards on the Home screen."
        value={insight}
        disabled={save.isPending}
        onSelect={(value) => save.mutate({ field: "insight", value })}
      />
      <View style={{ height: 8 }} />
      <LanguageRow
        label="Assistant"
        hint="The language the chat assistant replies in."
        value={chat}
        disabled={save.isPending}
        onSelect={(value) => save.mutate({ field: "chat", value })}
      />
      {save.isError ? (
        <ErrorText>{errorMessage(save.error, "Failed to save language.")}</ErrorText>
      ) : null}
    </Card>
  );
}
