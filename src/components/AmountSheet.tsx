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
import { parseAmountToCentavos } from "../lib/formatters";
import { Body, Button, ErrorText, Field } from "./ui";
import { useTheme } from "../theme/useTheme";

const ACCESSORY_ID = "sheet-amount-accessory";

export interface AmountSheetValues {
  /** Peso text as typed — `"150.75"`. Read into integer centavos on submit. */
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
// ponytail: a copy of web's `CURRENCY_SYMBOLS` (gastosai-web src/lib/formatters.ts); move it to
// `src/lib/formatters.ts` when a second mobile screen needs a symbol.
const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱", USD: "$", EUR: "€", SGD: "S$", JPY: "¥", GBP: "£", AUD: "A$",
};

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
  currency,
}: {
  visible: boolean;
  title: string;
  /** Omit for an amount-only sheet (adding to a goal); `label` is then submitted as `""`. */
  labelField?: string;
  labelPlaceholder?: string;
  initial?: Partial<AmountSheetValues>;
  submitLabel: string;
  submitting: boolean;
  serverError?: string | null;
  /** `amount` is integer centavos, ready for the API. */
  onSubmit: (values: { amount: number; label: string }) => void;
  onClose: () => void;
  footer?: React.ReactNode;
  /** The goal's currency. Omitted, or PHP, the amount is in pesos. */
  currency?: string;
}) {
  const t = useTheme();
  const foreign = !!currency && currency !== "PHP";
  const symbol = foreign ? (CURRENCY_SYMBOLS[currency] ?? currency) : "₱";
  // Same wording as web, so both platforms read a goal's amount out the same way.
  const amountName = foreign ? `Amount (${symbol})` : "Amount in pesos";
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    // Integer centavos, as the v2 contract takes them — never `Number(amount)`, which puts a
    // float between what was typed and what is saved.
    const parsed = parseAmountToCentavos(amount);
    if (parsed == null || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (labelField && !label.trim()) {
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
            // Cancel's 44 pt target now gives the bar its height; 14 on top of it made it 72 pt.
            paddingVertical: 4,
            borderBottomColor: t.colors.border,
            borderBottomWidth: 1,
          }}
        >
          {/* 44 pt targets of their own: hitSlop does not reliably reach past the parent's bounds. */}
          <Pressable
            testID="sheet-cancel"
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={10}
            style={{ minHeight: 44, justifyContent: "center" }}
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
                // text2, not text3: text3 misses 4.5:1 on the dark sheet.
                color: t.colors.text2,
              }}
            >
              AMOUNT
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Text style={{ fontFamily: t.fonts.display, fontSize: 34, color: t.colors.text3 }}>
                {symbol}
              </Text>
              <TextInput
                testID="sheet-amount"
                // The visible "AMOUNT" and symbol are separate texts a screen reader does not tie to it.
                accessibilityLabel={amountName}
                value={amount}
                // A peso has two decimal places: a third is refused, not rounded into a centavo
                // the user never typed.
                onChangeText={(v) => (/\.\d{3}/.test(v) ? undefined : setAmount(v))}
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

          {labelField ? (
            <Field
              testID="sheet-label"
              label={labelField}
              value={label}
              onChangeText={setLabel}
              placeholder={labelPlaceholder}
              autoCapitalize="words"
            />
          ) : null}

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
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                {/* textHi, not link: the link blue misses 4.5:1 on the dark accessory bar. */}
                <Body style={{ fontFamily: t.fonts.bodyMedium, fontSize: 16, color: t.colors.textHi }}>
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
