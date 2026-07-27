import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { errorMessage } from "../../src/api/client";
import { createExpense } from "../../src/api/expenses";
import ExpenseForm from "../../src/components/ExpenseForm";

export default function AddExpense() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Quick-add hands parsed values here when the user picks "Edit instead", so a low-confidence
  // parse becomes a starting point rather than a dead end.
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    category?: string;
    date?: string;
  }>();

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

  return (
    <>
      <Stack.Screen options={{ title: "Add expense" }} />
      <ExpenseForm
        initial={{
          amount: params.amount,
          description: params.description,
          category: params.category,
          date: params.date,
        }}
        submitLabel="Save"
        submitting={mutation.isPending}
        serverError={error}
        onSubmit={(body) => {
          setError(null);
          mutation.mutate(body);
        }}
      />
    </>
  );
}
