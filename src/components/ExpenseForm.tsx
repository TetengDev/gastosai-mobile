import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { listCategories } from "../api/expenses";
import type { ExpenseRequest } from "../api/types";
import { nowForApi } from "../lib/formatters";
import { Button, ErrorText, Field, colors } from "./ui";

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
 * Validation lives here so the two screens cannot drift apart on what counts as a valid
 * expense — which is exactly the kind of thing that diverges when a form is copy-pasted.
 */
export default function ExpenseForm({
  initial,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
  footer,
}: Props) {
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

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
      // to today and out of the month it belongs to.
      date: initial?.date ?? nowForApi(),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Field
          label="Amount (₱)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Lunch at Jollibee"
          autoCapitalize="sentences"
        />
        <Field
          label="Category (optional)"
          value={category}
          onChangeText={setCategory}
          placeholder={categories.data?.[0]?.name ?? "Food"}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Unknown categories are created automatically by the backend.
        </Text>
        <ErrorText>{localError ?? serverError}</ErrorText>
        <Button title={submitLabel} onPress={submit} loading={submitting} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
