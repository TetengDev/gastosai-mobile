import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import {
  aiLanguagePatch,
  ENGLISH_ONLY,
  fetchAiLanguages,
  getAiSettings,
  languageLabel,
  languageOptionsFor,
  resolveAiLanguage,
  updateAiSettings,
  type AiLanguageField,
  type AiLanguageOption,
} from "../api/aiSettings";
import { errorMessage } from "../api/client";
import { useTheme } from "../theme/useTheme";
import { Body, Card, ErrorText, Skeleton } from "./ui";

/**
 * The two AI languages, in the platform's own idiom.
 *
 * This was a row of tappable pills, which reads well for two options and not at all for the
 * eleven the server now publishes (`GET /ai/languages`) — the set is configuration-driven on the
 * backend, so an app that lays the options out flat breaks the next time someone adds one. Each
 * setting is now a row showing its current language, opening a list of everything the server
 * offers.
 *
 * Both read from and write to `/user/ai-settings`, and each writes only its own field — see
 * `aiLanguagePatch`. Saving is immediate: there is no Save button to leave un-pressed.
 */

function LanguagePicker({
  title,
  idPrefix,
  options,
  value,
  visible,
  onSelect,
  onClose,
}: {
  title: string;
  idPrefix: string;
  options: AiLanguageOption[];
  value: string;
  visible: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: t.colors.page }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: t.spacing.screen,
            paddingVertical: 14,
            borderBottomColor: t.colors.border,
            borderBottomWidth: 1,
          }}
        >
          <Pressable
            testID={`${idPrefix}-close`}
            accessibilityRole="button"
            accessibilityLabel={`Close the ${title.toLowerCase()} language list`}
            onPress={onClose}
            hitSlop={10}
          >
            <Text style={{ fontFamily: t.fonts.body, fontSize: 16, color: t.colors.text2 }}>
              Cancel
            </Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: t.fonts.display,
              fontSize: 17,
              color: t.colors.textHi,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ width: 52 }} />
        </View>

        <FlatList
          data={options}
          keyExtractor={(language) => language.code}
          contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingVertical: 8 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.colors.border3 }} />
          )}
          renderItem={({ item }) => {
            const selected = item.code === value;
            return (
              <Pressable
                // The id every option carried as a pill, so a stored choice is still addressable
                // by `ai-language-insights-fil` — in the demo flow and to VoiceOver.
                testID={`${idPrefix}-${item.code}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.displayName}
                onPress={() => onSelect(item.code)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: t.fonts.body,
                    fontSize: 16,
                    color: t.colors.textHi,
                  }}
                >
                  {item.displayName}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={19} color={t.colors.link} />
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

function LanguageRow({
  label,
  hint,
  options,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  options: AiLanguageOption[];
  value: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  // A code the server no longer offers still has to be shown and be changeable.
  const choices = languageOptionsFor(options, value);
  const current = languageLabel(choices, value);
  const idPrefix = `ai-language-${label.toLowerCase()}`;

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        testID={`${idPrefix}-row`}
        accessibilityRole="button"
        // Names which of the two settings this row changes, and what it is set to — the label
        // alone would read as "Insights" twice over with the list closed.
        accessibilityLabel={`${label} language, currently ${current}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
        })}
      >
        <Body style={{ flex: 1 }}>{label}</Body>
        <Text style={{ fontFamily: t.fonts.body, fontSize: 16, color: t.colors.text2 }}>
          {current}
        </Text>
        <Ionicons name="chevron-forward" size={17} color={t.colors.text3} />
      </Pressable>
      <Body dim style={{ fontSize: 12.5 }}>
        {hint}
      </Body>
      <LanguagePicker
        title={label}
        idPrefix={idPrefix}
        options={choices}
        value={value}
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={(code) => {
          setOpen(false);
          // Re-selecting what is already stored is a no-op rather than a pointless request.
          if (code !== value) onSelect(code);
        }}
      />
    </View>
  );
}

export function AiLanguageCard() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings,
  });

  // The supported set is the server's, and it changes with a configuration edit rather than with
  // a release. `fetchAiLanguages` never rejects — a failure resolves to English alone — so this
  // query has no error branch of its own.
  const { data: languages } = useQuery({
    queryKey: ["ai-languages"],
    queryFn: fetchAiLanguages,
  });

  const save = useMutation({
    mutationFn: ({ field, value }: { field: AiLanguageField; value: string }) =>
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

  // A failed load leaves nothing to select against — showing a current language over an unknown
  // stored value would claim a setting the user never chose.
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

  const options = languages ?? ENGLISH_ONLY;
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
        options={options}
        value={insight}
        disabled={save.isPending}
        onSelect={(value) => save.mutate({ field: "insight", value })}
      />
      <View style={{ height: 8 }} />
      <LanguageRow
        label="Assistant"
        hint="The language the chat assistant replies in."
        options={options}
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
