import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { listCategories, listExpenses } from "../api/expenses";
import type { ExpenseRequest } from "../api/types";
import { nowForApi } from "../lib/formatters";
import { Body, Button, ErrorText, Field, Pill } from "./ui";
import { useTheme } from "../theme/useTheme";

/**
 * iOS's `decimal-pad` has no return key, so there is nothing on the keypad that dismisses it —
 * and while it is up it covers the Save button. Without this bar the only way out is to scroll
 * the form, which is exactly the fiddliness the amount-first layout exists to remove.
 */
const AMOUNT_ACCESSORY_ID = "expense-amount-accessory";

export interface ExpenseFormValues {
  amount: string;
  description: string;
  category: string;
  /** Manila wall-clock, as the API expects. Preserved on edit so saving does not re-date it. */
  date?: string;
}

interface Props {
  initial?: Partial<ExpenseFormValues>;
  submitLabel: string;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (body: ExpenseRequest) => void;
  /** Rendered under the primary action — used for Delete on the edit screen. */
  footer?: React.ReactNode;
}

/**
 * The single expense form, shared by add and edit.
 *
 * Laid out around what is actually being captured rather than as three equal text inputs. The
 * amount is the one field that is always filled, so it leads, is large, and brings up the numeric
 * keypad on arrival. Categories are tapped rather than typed — typing one is the slowest part of
 * logging an expense, and the list is already fetched.
 *
 * Validation lives here so add and edit cannot drift apart on what counts as valid — the usual
 * fate of a copy-pasted form.
 */
export default function ExpenseForm({
  initial,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
  footer,
}: Props) {
  const t = useTheme();
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const recent = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });

  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * Categories ordered by how often they appear in the user's own recent expenses, so the likely
   * choice sits first. This only re-orders a list the client already holds — no totals or buckets
   * are derived here, which keeps it on the right side of "no business logic on-device".
   */
  const orderedCategories = useMemo(() => {
    const names = (categories.data ?? []).map((c) => c.name).filter((n): n is string => !!n);
    const counts = new Map<string, number>();
    for (const e of recent.data ?? []) {
      if (e.category) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    // Capped: this account has 13 categories, and rendering them all pushed the Save button off
    // screen. The long tail stays reachable through the free-text field below.
    return [...names].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 8);
  }, [categories.data, recent.data]);

  const submit = () => {
    setLocalError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("Enter an amount greater than zero.");
      return;
    }
    if (!description.trim()) {
      setLocalError("Description is required.");
      return;
    }
    onSubmit({
      amount: parsed,
      description: description.trim(),
      category: category.trim() || undefined,
      // On edit, keep the original timestamp — saving a correction should not move the expense
      // to today, and out of the month it belongs to.
      date: initial?.date ?? nowForApi(),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.colors.page }}
    >
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount leads and is large: it is the only field always filled, and decimal-pad means
            the right keyboard is already up on arrival. */}
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text
            style={{
              fontFamily: t.fonts.mono,
              fontSize: 11,
              letterSpacing: 1.3,
              color: t.colors.text3,
            }}
          >
            AMOUNT
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 34, color: t.colors.text3 }}>
              ₱
            </Text>
            <TextInput
              testID="expense-amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              inputAccessoryViewID={Platform.OS === "ios" ? AMOUNT_ACCESSORY_ID : undefined}
              placeholder="0.00"
              placeholderTextColor={t.colors.text3}
              autoFocus={!initial?.amount}
              style={{
                fontFamily: t.fonts.display,
                fontSize: 40,
                color: t.colors.textHi,
                minWidth: 140,
                paddingVertical: 4,
              }}
            />
          </View>
        </View>

        <Field
          testID="expense-description"
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Lunch at Jollibee"
          autoCapitalize="sentences"
        />

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text2 }}>
            Category
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {orderedCategories.map((name) => (
              <Pill
                key={name}
                testID={`category-${name}`}
                label={name}
                selected={category === name}
                // Tapping the selected chip clears it, so a mis-tap costs one tap to undo.
                onPress={() => setCategory(category === name ? "" : name)}
              />
            ))}
          </View>
          {/* The backend auto-creates unknown categories, so free text stays available for one
              that does not exist yet. */}
          <Field
            testID="expense-category"
            label="Or type a new one"
            value={category}
            onChangeText={setCategory}
            placeholder="New category"
          />
        </View>

        <ErrorText>{localError ?? serverError}</ErrorText>
        <Button title={submitLabel} onPress={submit} loading={submitting} />
        {footer}
        <Body dim style={{ fontSize: 12.5 }}>
          Unknown categories are created automatically.
        </Body>
      </ScrollView>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              backgroundColor: t.colors.surface2,
              borderTopColor: t.colors.border,
              borderTopWidth: 1,
              paddingHorizontal: t.spacing.screen,
              paddingVertical: 8,
            }}
          >
            <Pressable
              testID="amount-done"
              accessibilityRole="button"
              onPress={Keyboard.dismiss}
              hitSlop={12}
            >
              <Text
                style={{ fontFamily: t.fonts.bodyMedium, fontSize: 16, color: t.colors.link }}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </KeyboardAvoidingView>
  );
}
