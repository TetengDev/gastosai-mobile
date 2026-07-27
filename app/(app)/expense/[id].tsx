import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { errorMessage } from "../../../src/api/client";
import { deleteExpense, getExpense, updateExpense } from "../../../src/api/expenses";
import ExpenseForm from "../../../src/components/ExpenseForm";
import { Button, ErrorText, colors } from "../../../src/components/ui";

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const expense = useQuery({
    queryKey: ["expense", expenseId],
    queryFn: () => getExpense(expenseId),
    enabled: Number.isFinite(expenseId),
  });

  // Every mutation invalidates the same three things: this expense, the list, and the month
  // total. Editing an amount changes the total just as much as creating one does.
  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["report", "monthly"] }),
      queryClient.invalidateQueries({ queryKey: ["expense", expenseId] }),
    ]);
  };

  const save = useMutation({
    mutationFn: (body: Parameters<typeof updateExpense>[1]) => updateExpense(expenseId, body),
    onSuccess: async () => {
      await invalidateAll();
      router.back();
    },
    onError: (e) => setError(errorMessage(e, "Could not save the changes.")),
  });

  const remove = useMutation({
    mutationFn: () => deleteExpense(expenseId),
    onSuccess: async () => {
      await invalidateAll();
      router.back();
    },
    onError: (e) => setError(errorMessage(e, "Could not delete the expense.")),
  });

  const confirmDelete = () => {
    setError(null);
    // Destructive and irreversible from the user's side, so it asks first.
    Alert.alert("Delete expense?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);
  };

  if (expense.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <Stack.Screen options={{ title: "Edit expense" }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (expense.isError || !expense.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 }}>
        <Stack.Screen options={{ title: "Edit expense" }} />
        <ErrorText>{errorMessage(expense.error, "That expense could not be loaded.")}</ErrorText>
        <Button title="Try again" onPress={() => expense.refetch()} />
        <Button variant="ghost" title="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const e = expense.data;

  return (
    <>
      <Stack.Screen options={{ title: "Edit expense" }} />
      <ExpenseForm
        initial={{
          amount: e.amount != null ? String(e.amount) : "",
          description: e.description ?? "",
          category: e.category ?? "",
          // Preserved so a correction does not silently re-date the expense to now.
          date: e.date,
        }}
        submitLabel="Save changes"
        submitting={save.isPending}
        serverError={error}
        onSubmit={(body) => {
          setError(null);
          save.mutate(body);
        }}
        footer={
          <Button
            variant="ghost"
            title={remove.isPending ? "Deleting…" : "Delete expense"}
            onPress={confirmDelete}
            loading={remove.isPending}
          />
        }
      />
    </>
  );
}
