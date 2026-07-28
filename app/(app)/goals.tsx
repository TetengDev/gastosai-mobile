import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { createGoal, deleteGoal, listGoals, updateGoal } from "../../src/api/goals";
import type { GoalRequest, GoalResponse } from "../../src/api/types";
import { formatCurrency, formatDateOnly } from "../../src/lib/formatters";
import AmountSheet from "../../src/components/AmountSheet";
import {
  Body,
  Button,
  Card,
  ErrorText,
  Pill,
  ProgressBar,
  RowMenu,
  Skeleton,
} from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

type SheetMode =
  | { kind: "create" }
  | { kind: "contribute"; goal: GoalResponse }
  | { kind: "edit"; goal: GoalResponse };

/**
 * Savings goals — now writable.
 *
 * **Contributing is the frequent action, so it gets the primary affordance.** Creating a goal
 * happens once; adding to it happens every payday, and burying that behind an edit form would put
 * the common case behind the rare one.
 *
 * `progressPercent` and `status` are server-computed. A contribution sends the new saved total and
 * re-renders whatever comes back — it never advances the bar locally to feel quicker, which would
 * put the phone and every other client into disagreement (CLAUDE.md §1.2).
 */
export default function Goals() {
  const t = useTheme();
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["goals"],
    queryFn: listGoals,
  });

  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const goals = data ?? [];

  const close = () => setSheet(null);
  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["goals"] });
    close();
  };

  const create = useMutation({ mutationFn: createGoal, onSuccess: onSaved });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: GoalRequest }) => updateGoal(id, body),
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  /** A goal needs a name and both amounts to be sent back; anything missing is not editable. */
  const toRequest = (g: GoalResponse, overrides: Partial<GoalRequest>): GoalRequest | null => {
    if (!g.name || g.savedAmount == null || g.targetAmount == null) return null;
    return {
      name: g.name,
      savedAmount: g.savedAmount,
      targetAmount: g.targetAmount,
      targetDate: g.targetDate,
      currency: g.currency,
      paused: g.paused,
      ...overrides,
    };
  };

  const submitSheet = ({ amount, label }: { amount: number; label: string }) => {
    if (!sheet) return;
    if (sheet.kind === "create") {
      create.mutate({ name: label, targetAmount: amount, savedAmount: 0 });
      return;
    }
    const { goal } = sheet;
    if (goal.id == null) return;
    if (sheet.kind === "contribute") {
      // The *new total*, not the delta: the API stores an absolute saved amount, and the sheet
      // opens pre-filled with the current one so adding to it is a small edit.
      const body = toRequest(goal, { savedAmount: amount });
      if (body) update.mutate({ id: goal.id, body });
      return;
    }
    const body = toRequest(goal, { name: label, targetAmount: amount });
    if (body) update.mutate({ id: goal.id, body });
  };

  const confirmDelete = (g: GoalResponse) =>
    Alert.alert(`Delete “${g.name}”?`, "The goal and its saved progress are removed.", [
      { text: "Cancel", style: "cancel" },
      {
        // Names what it deletes rather than saying a bare "Delete": every goal row also has a
        // Delete link, so an unqualified label is ambiguous both to a reader skimming the dialog
        // and to UI automation, which cannot tell the confirm button from the row behind it.
        text: "Delete",
        style: "destructive",
        onPress: () => (g.id != null ? remove.mutate(g.id) : undefined),
      },
    ]);

  const sheetProps = () => {
    if (!sheet) return null;
    if (sheet.kind === "create") {
      return {
        title: "New goal",
        labelField: "Goal name",
        labelPlaceholder: "Emergency fund",
        submitLabel: "Create goal",
        initial: undefined,
      };
    }
    if (sheet.kind === "contribute") {
      return {
        title: "Update saved",
        labelField: "Goal name",
        labelPlaceholder: "Emergency fund",
        submitLabel: "Save",
        initial: {
          amount: sheet.goal.savedAmount != null ? String(sheet.goal.savedAmount) : "",
          label: sheet.goal.name ?? "",
        },
      };
    }
    return {
      title: "Edit goal",
      labelField: "Goal name",
      labelPlaceholder: "Emergency fund",
      submitLabel: "Save changes",
      initial: {
        amount: sheet.goal.targetAmount != null ? String(sheet.goal.targetAmount) : "",
        label: sheet.goal.name ?? "",
      },
    };
  };

  const props = sheetProps();
  const pending = create.isPending || update.isPending;
  const mutationError = create.isError
    ? errorMessage(create.error)
    : update.isError
      ? errorMessage(update.error)
      : null;

  return (
    <>
      <ScrollView
        testID="goals-screen"
        style={{ flex: 1, backgroundColor: t.colors.page }}
        contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.colors.text2} />
        }
      >
        {isLoading && <Skeleton height={140} />}

        {isError && (
          <View style={{ gap: 12 }}>
            <ErrorText>{errorMessage(error, "Could not load your goals.")}</ErrorText>
            <Button title="Try again" onPress={() => refetch()} />
          </View>
        )}

        {!isLoading && !isError && goals.length === 0 && (
          <Card>
            <Body>No savings goals yet.</Body>
            <Body dim style={{ fontSize: 12.5 }}>
              A goal turns “I should save more” into a number you can watch move.
            </Body>
            <Button
              testID="goal-create"
              title="Create a goal"
              onPress={() => setSheet({ kind: "create" })}
            />
          </Card>
        )}

        {goals.map((g, i) => (
          <Card key={g.id}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
                {g.name}
              </Text>
              {g.paused ? <Pill label="Paused" /> : null}
            </View>
            {/* progressPercent is server-computed; the client renders it as given. */}
            <ProgressBar percent={g.progressPercent ?? 0} />
            <Body dim style={{ fontSize: 12.5 }}>
              {formatCurrency(g.savedAmount ?? 0)} of {formatCurrency(g.targetAmount ?? 0)} ·{" "}
              {Math.round(g.progressPercent ?? 0)}%
            </Body>
            {g.targetDate ? (
              <Body dim style={{ fontSize: 12 }}>
                by {formatDateOnly(g.targetDate)}
              </Body>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Button
                  testID={`goal-contribute-${g.id}`}
                  size="sm"
                  title="Add savings"
                  onPress={() => setSheet({ kind: "contribute", goal: g })}
                />
              </View>
              {/* Contributing is the frequent action and stays on the row; editing and deleting a
                  goal are rare and move behind the menu. */}
              <RowMenu
                // Positional: this flow creates the goal it then deletes, so its id is not knowable
                // in advance. Same reasoning as `recent-row-N` on Home.
                testID={`goal-menu-${i}`}
                title={g.name ?? undefined}
                actions={[
                  { label: "Edit goal", onPress: () => setSheet({ kind: "edit", goal: g }) },
                  { label: "Delete goal…", destructive: true, onPress: () => confirmDelete(g) },
                ]}
              />
            </View>
          </Card>
        ))}

        {goals.length > 0 && (
          <Button
            testID="goal-create"
            variant="secondary"
            title="New goal"
            onPress={() => setSheet({ kind: "create" })}
          />
        )}

        <ErrorText>{remove.isError ? errorMessage(remove.error) : null}</ErrorText>
      </ScrollView>

      {props ? (
        <AmountSheet
          visible
          title={props.title}
          labelField={props.labelField}
          labelPlaceholder={props.labelPlaceholder}
          submitLabel={props.submitLabel}
          initial={props.initial}
          submitting={pending}
          serverError={mutationError}
          onSubmit={submitSheet}
          onClose={close}
        />
      ) : null}
    </>
  );
}
