import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { scanReceipt } from "../../src/api/ai";
import { parseExpense } from "../../src/api/expenses";
import type { ParsedExpenseResult } from "../../src/api/types";
import { formatCentavos, formatDate } from "../../src/lib/formatters";
import { centavosToInput } from "../../src/components/money";
import { LoggedNotice, useLogExpense, useVisitKey } from "../../src/components/ExpenseForm";
import { Body, Button, Card, ErrorText, Field, Pill } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";
import { accents } from "../../src/theme";

/** HIGH / MEDIUM / LOW from the model, mapped to the shared accent colours. */
function confidenceColor(c?: string): string {
  if (c === "HIGH") return accents.brand;
  if (c === "MEDIUM") return accents.amber;
  return accents.alert;
}

/** Remounted on every return visit: the route is a hidden tab that stays mounted. */
export default function QuickAdd() {
  return <QuickAddScreen key={useVisitKey()} />;
}

function QuickAddScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedExpenseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const t = useTheme();

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

  // Invalidation, the month reset and the 1.2 s hold on Piso `saved` live in the hook, shared
  // with add-expense.
  const { save, logged } = useLogExpense(setError);

  const scan = useMutation({
    mutationFn: ({ uri, mimeType }: { uri: string; mimeType?: string }) =>
      scanReceipt(uri, mimeType),
    onSuccess: (result) => setParsed(result),
    onError: (e) => {
      // Same graceful 429 as typed parsing: reading a receipt spends the same AI quota.
      if (axios.isAxiosError(e) && e.response?.status === 429) {
        setQuotaReached(true);
        setError("AI limit reached for now. You can still add the expense manually.");
        return;
      }
      if (axios.isAxiosError(e) && e.code === "ECONNABORTED") {
        setError("The upload timed out. Try again on a better connection.");
        return;
      }
      // A 5xx here is the vision provider failing, not the photo being bad. The server's own
      // wording for that is "An unexpected error occurred", which tells the user nothing and
      // implies they did something wrong; say what actually happened and leave them a way
      // forward. 4xx keeps the server's message, which is specific and actionable (quota, size).
      if (axios.isAxiosError(e) && (e.response?.status ?? 0) >= 500) {
        setQuotaReached(true);
        setError("Receipt reading is unavailable right now. You can still add the expense manually.");
        return;
      }
      setError(errorMessage(e, "Could not read that receipt. Try a clearer photo."));
    },
  });

  const runParse = () => {
    // The saved hold is on its way out; a new read would be abandoned mid-flight.
    if (logged || save.isPending) return;
    // The proposal card renders below; with the keyboard still up it would sit behind it.
    Keyboard.dismiss();
    setError(null);
    setParsed(null);
    setQuotaReached(false);
    if (!text.trim()) {
      setError("Type what you spent, e.g. “lunch 150 at Jollibee”.");
      return;
    }
    parse.mutate({ text: text.trim() });
  };

  /**
   * Camera or library, then straight to `/ai/vision`.
   *
   * Permission is requested at the moment the user asks to take a photo, not on screen entry — a
   * prompt that appears before you have expressed any interest in the camera is the one most
   * people deny, and iOS only ever asks once.
   */
  const capture = async (source: "camera" | "library") => {
    if (logged || save.isPending) return;
    // As in runParse: the proposal card the photo comes back as would sit behind the keyboard.
    Keyboard.dismiss();
    setError(null);
    setParsed(null);
    setQuotaReached(false);

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      // `canAskAgain: false` means the system dialog will never reappear, so telling the user to
      // "allow it" is useless — the only route left is Settings.
      setError(
        permission.canAskAgain
          ? "Photo access is needed to read a receipt."
          : "Photo access is off. Turn it on in Settings to scan receipts.",
      );
      if (!permission.canAskAgain) setPermissionBlocked(true);
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      // Receipts are long and thin; cropping them is how you lose the total.
      allowsEditing: false,
      // Enough for the model to read, small enough not to stall on mobile data.
      quality: 0.6,
    };

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    scan.mutate({ uri: asset.uri, mimeType: asset.mimeType });
  };

  /**
   * What to call the expense when the model returned no description.
   *
   * Typed entry can fall back to what the user wrote, but a scanned receipt has no typed text at
   * all — falling back to `text.trim()` there produced an expense with an empty description, which
   * the form then rejects as invalid on a screen the user cannot see.
   */
  const fallbackDescription = () => text.trim() || "Receipt";

  const editInstead = () => {
    // Mid-save, the form would open prefilled with an expense about to exist, and a save there
    // would log it twice.
    if (logged || save.isPending) return;
    router.replace({
      pathname: "/(app)/add-expense",
      params: {
        // The form edits pesos; the parse result is centavos.
        amount: parsed?.amount != null ? centavosToInput(parsed.amount) : undefined,
        description: parsed?.description ?? fallbackDescription(),
        category: parsed?.category ?? undefined,
        date: parsed?.date ?? undefined,
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // ponytail: the header's height, fixed as chat.tsx does; useHeaderHeight lives in
      // @react-navigation/elements, which is not a direct dependency.
      keyboardVerticalOffset={90}
      style={{ flex: 1, backgroundColor: t.colors.page }}
    >
      <ScrollView
        // Bottom room so the proposal card and its Save can scroll clear of the keyboard.
        contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
  
        <Field
          testID="quick-add-input"
          label="What did you spend on?"
          // Field's visible label is a separate text a screen reader does not tie to the input.
          accessibilityLabel="What did you spend on?"
          value={text}
          onChangeText={setText}
          placeholder="lunch 150 at Jollibee"
          autoCapitalize="sentences"
          multiline
          // Spec §4: focused on open, so the keyboard is up before the first tap.
          autoFocus
          onSubmitEditing={runParse}
        />
        <Button title="Read it" onPress={runParse} loading={parse.isPending} />

        {/* The camera is the reason this app is worth having at the till: the receipt is already
            in your hand, and typing it back in is the slow path. It sits beside typed entry
            rather than replacing it — a photo fails far more often than a sentence does. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
          <Body dim style={{ fontSize: 12 }}>
            or
          </Body>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              testID="scan-receipt"
              variant="secondary"
              title="Scan receipt"
              loading={scan.isPending}
              onPress={() => capture("camera")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              testID="choose-photo"
              variant="secondary"
              title="Choose photo"
              onPress={() => capture("library")}
            />
          </View>
        </View>

        {/* The amount-first form, always one tap away rather than only after a parse or a 429. */}
        <Button
          testID="enter-manually"
          variant="ghost"
          title="Enter manually"
          onPress={() => {
            if (logged || save.isPending) return;
            router.replace({ pathname: "/(app)/add-expense" });
          }}
        />

        <ErrorText>{error}</ErrorText>

        {permissionBlocked && (
          <Button
            variant="ghost"
            title="Open Settings"
            onPress={() => Linking.openSettings()}
          />
        )}

        {quotaReached && (
          <Button variant="secondary" title="Add manually instead" onPress={editInstead} />
        )}

        {parsed && (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: t.fonts.display, fontSize: 28, color: t.colors.textHi }}>
                {formatCentavos(parsed.amount ?? 0)}
              </Text>
              <Pill
                label={parsed.confidence ?? "UNKNOWN"}
                dotColor={confidenceColor(parsed.confidence)}
              />
            </View>
            <Body>{parsed.description ?? "-"}</Body>
            <Body dim style={{ fontSize: 13 }}>
              {parsed.category ?? "Uncategorized"} · {formatDate(parsed.date)}
            </Body>

            {/* The backend explains itself through these two fields; surfacing them is the
                difference between "it didn't work" and knowing what to type instead. */}
            {parsed.hint ? (
              <Body dim style={{ fontSize: 13, marginTop: 6 }}>{parsed.hint}</Body>
            ) : null}
            {parsed.rejectionMessage ? (
              <ErrorText>{parsed.rejectionMessage}</ErrorText>
            ) : null}

            {logged ? (
              <LoggedNotice logged={logged} />
            ) : parsed.saveable ? (
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
                      description: parsed.description ?? fallbackDescription(),
                      category: parsed.category ?? undefined,
                      // Already Manila wall-clock with an offset — pass it through unchanged.
                      date: parsed.date,
                    });
                  }}
                />
                <Button variant="secondary" title="Edit first" onPress={editInstead} />
              </>
            ) : (
              <Button variant="secondary" title="Add manually instead" onPress={editInstead} />
            )}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
