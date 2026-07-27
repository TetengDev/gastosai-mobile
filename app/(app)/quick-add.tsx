import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import axios from "axios";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { createExpense, parseExpense } from "../../src/api/expenses";
import type { ParsedExpenseResult } from "../../src/api/types";
import { formatCurrency, formatDate } from "../../src/lib/formatters";
import { Badge, Button, Card, ErrorText, Field, colors } from "../../src/components/ui";

/** HIGH / MEDIUM / LOW from the model, mapped to a visual tone. */
function confidenceTone(c?: string): "good" | "warn" | "bad" {
  if (c === "HIGH") return "good";
  if (c === "MEDIUM") return "warn";
  return "bad";
}

export default function QuickAdd() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedExpenseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState(false);

  const parse = useMutation({
    mutationFn: parseExpense,
    onSuccess: (result) => setParsed(result),
    onError: (e) => {
      // Parsing spends AI quota. A 429 is an expected outcome, not a failure to shout about —
      // CLAUDE.md requires AI surfaces to degrade gracefully, so this offers the manual form
      // instead of dead-ending the user.
      if (axios.isAxiosError(e) && e.response?.status === 429) {
        setQuotaReached(true);
        setError("AI limit reached for now. You can still add the expense manually.");
        return;
      }
      setError(errorMessage(e, "Could not read that. Try rephrasing it."));
    },
  });

  const save = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["report", "monthly"] });
      router.back();
    },
    onError: (e) => setError(errorMessage(e, "Could not save the expense.")),
  });

  const runParse = () => {
    setError(null);
    setParsed(null);
    setQuotaReached(false);
    if (!text.trim()) {
      setError("Type what you spent, e.g. “lunch 150 at Jollibee”.");
      return;
    }
    parse.mutate({ text: text.trim() });
  };

  const editInstead = () =>
    router.replace({
      pathname: "/(app)/add-expense",
      params: {
        amount: parsed?.amount != null ? String(parsed.amount) : undefined,
        description: parsed?.description ?? text.trim(),
        category: parsed?.category ?? undefined,
        date: parsed?.date ?? undefined,
      },
    });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: "Quick add" }} />

        <Field
          label="What did you spend on?"
          value={text}
          onChangeText={setText}
          placeholder="lunch 150 at Jollibee"
          autoCapitalize="sentences"
          multiline
          onSubmitEditing={runParse}
        />
        <Button title="Read it" onPress={runParse} loading={parse.isPending} />

        <ErrorText>{error}</ErrorText>

        {quotaReached && (
          <Button variant="ghost" title="Add manually instead" onPress={editInstead} />
        )}

        {parsed && (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
                {formatCurrency(parsed.amount ?? 0)}
              </Text>
              <Badge label={parsed.confidence ?? "UNKNOWN"} tone={confidenceTone(parsed.confidence)} />
            </View>
            <Text style={{ color: colors.text }}>{parsed.description ?? "-"}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {parsed.category ?? "Uncategorized"} · {formatDate(parsed.date)}
            </Text>

            {/* The backend explains itself through these two fields; surfacing them is the
                difference between "it didn't work" and knowing what to type instead. */}
            {parsed.hint ? (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>{parsed.hint}</Text>
            ) : null}
            {parsed.rejectionMessage ? (
              <ErrorText>{parsed.rejectionMessage}</ErrorText>
            ) : null}

            {parsed.saveable ? (
              <>
                {/* Never auto-saved. The model can be wrong, and a silently created wrong
                    expense is worse than no expense — the user confirms what gets stored. */}
                <Button
                  title="Save this"
                  loading={save.isPending}
                  onPress={() => {
                    setError(null);
                    save.mutate({
                      amount: parsed.amount ?? 0,
                      description: parsed.description ?? text.trim(),
                      category: parsed.category ?? undefined,
                      // Already Manila wall-clock with an offset — pass it through unchanged.
                      date: parsed.date,
                    });
                  }}
                />
                <Button variant="ghost" title="Edit first" onPress={editInstead} />
              </>
            ) : (
              <Button variant="ghost" title="Add manually instead" onPress={editInstead} />
            )}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
