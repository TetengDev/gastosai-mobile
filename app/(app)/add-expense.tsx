import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { createExpense, listCategories } from "../../src/api/expenses";
import { errorMessage } from "../../src/api/client";
import { nowForApi } from "../../src/lib/formatters";
import { Button, ErrorText, Field, colors } from "../../src/components/ui";

export default function AddExpense() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      // Both the list and the month total are now stale.
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["report", "monthly"] });
      router.back();
    },
    onError: (e) => setError(errorMessage(e, "Could not save the expense.")),
  });

  const submit = () => {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    mutation.mutate({
      amount: parsed,
      description: description.trim(),
      category: category.trim() || undefined,
      // Manila wall-clock, not the device's: see nowForApi.
      date: nowForApi(),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Stack.Screen options={{ title: "Add expense" }} />
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
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={submit} loading={mutation.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
