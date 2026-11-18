import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { errorMessage } from "../../src/api/client";
import ExpenseForm, { LoggedNotice, useLogExpense, useVisitKey } from "../../src/components/ExpenseForm";

/** Remounted on every return visit: the route is a hidden tab that stays mounted. */
export default function AddExpense() {
  return <AddExpenseScreen key={useVisitKey()} />;
}

function AddExpenseScreen() {
  const [error, setError] = useState<string | null>(null);

  // Quick-add hands parsed values here when the user picks "Edit instead", so a low-confidence
  // parse becomes a starting point rather than a dead end.
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    category?: string;
    date?: string;
  }>();

  // Invalidation, the month reset and the 1.2 s hold on Piso `saved` live in the hook, shared
  // with quick-add.
  const { save, logged } = useLogExpense((e) => setError(errorMessage(e, "Could not save the expense.")));

  return (
    <ExpenseForm
      initial={{
        amount: params.amount,
        description: params.description,
        category: params.category,
        date: params.date,
      }}
      submitLabel="Save"
      submitting={save.isPending}
      serverError={error}
      confirmation={logged ? <LoggedNotice logged={logged} /> : undefined}
      onSubmit={(body) => {
        setError(null);
        save.mutate(body);
      }}
    />
  );
}
