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
import type { BudgetSummaryItem, ExpenseRequest, ExpenseResponse } from "../api/types";
import { formatCentavos, nowForApi, parseAmountToCentavos } from "../lib/formatters";
import { expenseAmountText } from "./money";
import { Button, ErrorText, Field, Pill } from "./ui";
import { useTheme } from "../theme/useTheme";

/**
 * iOS's `decimal-pad` has no return key, so there is nothing on the keypad that dismisses it —
 * and while it is up it covers the Save button. Without this bar the only way out is to scroll
 * the form, which is exactly the fiddliness the amount-first layout exists to remove.
 */
const AMOUNT_ACCESSORY_ID = "expense-amount-accessory";

export interface ExpenseFormValues {
  /** Peso text as typed — `"150.75"`. Turned into integer centavos on submit, never before. */
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
  /**
   * Shown in place of the primary action once a new expense is saved, so the confirmation sits
   * where the Save button was and the button cannot be tapped twice during the hold.
   */
  confirmation?: React.ReactNode;
}

/** How many category chips the form offers (spec §4). */
const CHIP_COUNT = 6;

/**
 * R19's confirmation line, identical on web. `remaining` is the server's figure for the saved
 * category's budget line in the expense's month; nothing here is derived from budgeted or spent.
 */
export function loggedLine(
  saved: ExpenseResponse,
  items: readonly BudgetSummaryItem[] | undefined,
): string {
  const logged = `Logged ${expenseAmountText(saved).base}`;
  const remaining = saved.category
    ? items?.find((i) => i.categoryName === saved.category)?.remaining
    : undefined;
  if (remaining == null) return logged;
  return remaining >= 0
    ? `${logged} · ${formatCentavos(remaining)} left in ${saved.category}`
    : `${logged} · Over by ${formatCentavos(-remaining)} in ${saved.category}`;
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
  confirmation,
}: Props) {
  const t = useTheme();
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  // Wrapped, not passed bare: TanStack calls queryFn with its own context object, which
  // `listExpenses` would take as a date range and forward as nonsense query params.
  // Deliberately unscoped by month — the recent categories are the whole history's, not one month's.
  const recent = useQuery({ queryKey: ["expenses", "all"], queryFn: () => listExpenses() });

  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * The six categories most recently used (R20): the first distinct ones met walking the user's
   * expenses newest first, as `GET /expenses` serves them. Topped up from the category list, so a
   * user with little history still has chips. Only picks from lists the client already holds.
   */
  const recentCategories = useMemo(() => {
    const used = (recent.data ?? []).map((e) => e.category);
    const names = (categories.data ?? []).map((c) => c.name);
    return [...new Set([...used, ...names])]
      .filter((n): n is string => !!n)
      .slice(0, CHIP_COUNT);
  }, [categories.data, recent.data]);

  const submit = () => {
    setLocalError(null);
    // Centavos, read digit by digit. `Number(amount)` would hand the API a float — "0.29" becomes
    // 28.999999999999996 the moment anything scales it — and the v2 contract takes an integer.
    const parsed = parseAmountToCentavos(amount);
    if (parsed == null || parsed <= 0) {
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
              // text2, not text3: text3 misses 4.5:1 in dark mode.
              color: t.colors.text2,
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
              // The visible "AMOUNT" and "₱" are separate texts a screen reader does not tie to it.
              accessibilityLabel="Amount in pesos"
              value={amount}
              // A peso has two decimal places: a third is refused, not rounded into a centavo
              // the user never typed.
              onChangeText={(v) => (/\.\d{3}/.test(v) ? undefined : setAmount(v))}
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

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text2 }}>
            Category
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {recentCategories.map((name) => (
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
            accessibilityLabel="Or type a new category"
          />
        </View>

        <Field
          testID="expense-description"
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Lunch at Jollibee"
          autoCapitalize="sentences"
          accessibilityLabel="Description"
        />

        <ErrorText>{localError ?? serverError}</ErrorText>
        {confirmation ?? <Button title={submitLabel} onPress={submit} loading={submitting} />}
        {footer}
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
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              {/* textHi, not link: the link blue misses 4.5:1 on the dark accessory bar. */}
              <Text
                style={{ fontFamily: t.fonts.bodyMedium, fontSize: 16, color: t.colors.textHi }}
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
