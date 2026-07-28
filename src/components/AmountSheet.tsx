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
import { Body, Button, ErrorText, Field } from "./ui";
import { useTheme } from "../theme/useTheme";

const ACCESSORY_ID = "sheet-amount-accessory";

export interface AmountSheetValues {
  amount: string;
  /** Doubles as the goal name or the budget's category, depending on the caller. */
  label: string;
}

/**
 * A modal for capturing a name and an amount — the shape both a budget and a savings goal reduce
 * to on a phone.
 *
 * It reuses the capture flow's amount-first layout deliberately: the amount is the field that is
 * always filled, so it leads and is large, and the numeric keypad is up on arrival. Making
 * "set a budget" feel like "record an expense" is the point — one input pattern for one kind of
 * value, rather than a second form the user has to learn.
 *
 * The Done bar exists for the same reason it does on the expense form: `decimal-pad` has no
 * return key, and without it the keypad covers the save button.
 */
export default function AmountSheet({
  visible,
  title,
  labelField,
  labelPlaceholder,
  initial,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  labelField: string;
  labelPlaceholder: string;
  initial?: Partial<AmountSheetValues>;
  submitLabel: string;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (values: { amount: number; label: string }) => void;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!label.trim()) {
      setError(`${labelField} is required.`);
      return;
    }
    onSubmit({ amount: parsed, label: label.trim() });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      // Remount on each open so a previous edit's values never leak into the next one.
      onShow={() => {
        setAmount(initial?.amount ?? "");
        setLabel(initial?.label ?? "");
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
          <Pressable testID="sheet-cancel" accessibilityRole="button" onPress={onClose} hitSlop={10}>
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
          >
            {title}
          </Text>
          {/* Balances the Cancel label so the title sits centred. */}
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
              AMOUNT
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Text style={{ fontFamily: t.fonts.display, fontSize: 34, color: t.colors.text3 }}>
                ₱
              </Text>
              <TextInput
                testID="sheet-amount"
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

          <Field
            testID="sheet-label"
            label={labelField}
            value={label}
            onChangeText={setLabel}
            placeholder={labelPlaceholder}
            autoCapitalize="words"
          />

          <ErrorText>{error ?? serverError}</ErrorText>
          <Button testID="sheet-save" title={submitLabel} onPress={submit} loading={submitting} />
          {footer}
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
                testID="sheet-amount-done"
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
