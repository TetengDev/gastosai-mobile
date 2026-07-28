import { useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CategoryResponse } from "../api/types";
import { Body, Button, ErrorText, Pill } from "./ui";
import { useTheme } from "../theme/useTheme";

const ACCESSORY_ID = "budget-amount-accessory";

/**
 * Set or change a monthly limit.
 *
 * Reuses the capture flow's amount-first layout on purpose: a budget is the same kind of value as
 * an expense, so it deserves the same input, and one pattern learned once beats two forms.
 *
 * `categories` is empty when editing — the category is fixed by the row that was tapped, and
 * offering to change it there would silently move the budget rather than edit it. When creating,
 * the caller passes only categories that do not already have a budget this month; budgeting the
 * same category twice is a 400 the user cannot interpret.
 */
export default function BudgetSheet({
  visible,
  title,
  submitLabel,
  initialAmount,
  categories,
  submitting,
  serverError,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  submitLabel: string;
  initialAmount: string;
  categories: CategoryResponse[];
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (values: { amount: number; categoryId?: number }) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const picking = categories.length > 0;

  const [amount, setAmount] = useState(initialAmount);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (picking && categoryId == null) {
      setError("Pick a category.");
      return;
    }
    onSubmit({ amount: parsed, categoryId });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={() => {
        setAmount(initialAmount);
        setCategoryId(undefined);
        setError(null);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: t.colors.page }}
      >
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
          <Pressable testID="budget-cancel" accessibilityRole="button" onPress={onClose} hitSlop={10}>
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

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text
              style={{
                fontFamily: t.fonts.mono,
                fontSize: 11,
                letterSpacing: 1.3,
                color: t.colors.text3,
              }}
            >
              MONTHLY LIMIT
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Text style={{ fontFamily: t.fonts.display, fontSize: 34, color: t.colors.text3 }}>
                ₱
              </Text>
              <TextInput
                testID="budget-amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                inputAccessoryViewID={Platform.OS === "ios" ? ACCESSORY_ID : undefined}
                placeholder="0.00"
                placeholderTextColor={t.colors.text3}
                autoFocus
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

          {picking ? (
            <View style={{ gap: 8 }}>
              <Body dim style={{ fontSize: 13 }}>
                Category
              </Body>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {categories.map((c) => (
                  <Pill
                    key={c.id}
                    testID={`budget-category-${c.name}`}
                    label={c.name ?? ""}
                    selected={categoryId === c.id}
                    onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <ErrorText>{error ?? serverError}</ErrorText>
          <Button testID="budget-save" title={submitLabel} onPress={submit} loading={submitting} />
        </ScrollView>

        {Platform.OS === "ios" ? (
          <InputAccessoryView nativeID={ACCESSORY_ID}>
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
                testID="budget-amount-done"
                accessibilityRole="button"
                onPress={Keyboard.dismiss}
                hitSlop={12}
              >
                <Body style={{ fontFamily: t.fonts.bodyMedium, fontSize: 16, color: t.colors.link }}>
                  Done
                </Body>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
