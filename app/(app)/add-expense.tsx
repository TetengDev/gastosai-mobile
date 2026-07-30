import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { errorMessage } from "../../src/api/client";
import { useMonth } from "../../src/context/MonthContext";
import { useNavOrigin } from "../../src/context/NavOriginContext";
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

  const { resetToCurrent } = useMonth();
  const origin = useNavOrigin();

  const mutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      // Both the list and the month total are now stale.
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["report", "monthly"] });
      // Same reason as quick-add: a new expense is dated today, so a user who was browsing an
      // earlier month would save successfully and see nothing.
      resetToCurrent();
      router.navigate(origin as never);
    },
    onError: (e) => setError(errorMessage(e, "Could not save the expense.")),
  });

  return (
    <>
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
