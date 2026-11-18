import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { createGoal, deleteGoal, listGoals, updateGoal } from "../../src/api/goals";
import type { GoalRequest, GoalResponse } from "../../src/api/types";
import { formatCentavos, formatDateOnly } from "../../src/lib/formatters";
import { goalTone, pisoMoodFor } from "../../src/lib/pisoMood";
import { Piso } from "../../src/brand/Piso";
import { Celebrate } from "../../src/components/Celebrate";
import { centavosToInput } from "../../src/components/money";
import AmountSheet from "../../src/components/AmountSheet";
import {
  Body,
  Button,
  Card,
  ErrorText,
  Pill,
  ProgressMeter,
  RowMenu,
  Skeleton,
} from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

const PISO_SIZE = 44;

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
 * `progressPercent` and `status` are server-computed. "Add savings" asks for the amount to add, as
 * on web; the API stores an absolute saved total, so the screen sends the current total plus that
 * amount and re-renders whatever comes back. It never advances the bar locally to feel quicker,
 * which would put the phone and every other client into disagreement (CLAUDE.md §1.2).
 *
 * A goal the server marks `COMPLETED` leaves the list: it plays `Celebrate` once over the header
 * Piso, then sits in a collapsed Achieved group (spec §4, R25). The split reads `status` only,
 * never `progressPercent`, so a goal at 100% the server has not closed stays where it is.
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
  const active = goals.filter((g) => g.status !== "COMPLETED");
  const achieved = goals.filter((g) => g.status === "COMPLETED");
  const [showAchieved, setShowAchieved] = useState(false);

  // One celebration at a time, each unmounted once it has played so the cheer folds away and the
  // header Piso returns. Seen events finish at once, so a revisit shows nothing.
  const [celebrated, setCelebrated] = useState<readonly string[]>([]);
  // Only while this tab is on screen: tabs stay mounted when hidden, and a cheer played behind
  // another tab is spent where nobody sees it.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const celebration = focused
    ? achieved.map((g) => `goal-${g.id}`).find((e) => !celebrated.includes(e))
    : undefined;

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
      // The API stores an absolute total, so the amount added is summed here, in integer
      // centavos, onto the goal as it stands now: the sheet's snapshot may predate a refresh.
      const current = goals.find((g) => g.id === goal.id);
      if (current?.savedAmount == null) return;
      const body = toRequest(current, { savedAmount: current.savedAmount + amount });
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
      // Amount only, opening empty: the goal is already chosen, and what is asked is how much
      // to add, not the new total.
      return {
        title: "Add savings",
        labelField: undefined,
        labelPlaceholder: undefined,
        submitLabel: "Add",
        initial: undefined,
      };
    }
    return {
      title: "Edit goal",
      labelField: "Goal name",
      labelPlaceholder: "Emergency fund",
      submitLabel: "Save changes",
      initial: {
        amount: centavosToInput(sheet.goal.targetAmount),
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

  /**
   * One goal. An achieved one keeps its meter and figures but loses "Add savings": the filled
   * button belongs to goals that still need it. Its menu has its own testID family so `goal-menu-N`
   * stays indexed over the active list, which is what the Maestro flows tap.
   */
  const goalCard = (g: GoalResponse, i: number, done: boolean) => {
    const menu = (
      <RowMenu
        // Positional: a flow creates the goal it then deletes, so its id is not knowable in
        // advance. Same reasoning as `recent-row-N` on Home.
        testID={done ? `goal-achieved-menu-${i}` : `goal-menu-${i}`}
        title={g.name ?? undefined}
        actions={[
          { label: "Edit goal", onPress: () => setSheet({ kind: "edit", goal: g }) },
          { label: "Delete goal…", destructive: true, onPress: () => confirmDelete(g) },
        ]}
      />
    );
    return (
      <Card key={g.id}>
        {/* 44 pt row: the menu's 36 pt target cannot rely on hitSlop past the parent's bounds. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
          <Text
            numberOfLines={2}
            style={{ flex: 1, fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}
          >
            {g.name}
          </Text>
          {g.paused ? <Pill label="Paused" /> : null}
          {done ? menu : null}
        </View>
        {/* progressPercent is server-computed; the client renders it as given. */}
        <ProgressMeter
          percent={g.progressPercent ?? 0}
          tone={g.paused ? "paused" : goalTone(g.status ?? "ON_TRACK")}
          label={g.name ?? "Goal"}
        />
        <Body dim style={{ fontSize: t.fontSizes.caption }}>
          {formatCentavos(g.savedAmount ?? 0)} of {formatCentavos(g.targetAmount ?? 0)} ·{" "}
          {Math.round(g.progressPercent ?? 0)}%
        </Body>
        {g.targetDate && !done ? (
          <Body dim style={{ fontSize: t.fontSizes.caption }}>
            by {formatDateOnly(g.targetDate)}
          </Body>
        ) : null}

        {done ? null : (
          // Contributing is the frequent action and stays on the card, full size; editing and
          // deleting are rare and sit behind the menu.
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6, minHeight: 44 }}
          >
            <View style={{ flex: 1 }}>
              <Button
                testID={`goal-contribute-${g.id}`}
                title="Add savings"
                onPress={() => setSheet({ kind: "contribute", goal: g })}
              />
            </View>
            {menu}
          </View>
        )}
      </Card>
    );
  };

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
        {/* The screen's one Piso, drawn only once there are goals to be in a mood about: never
            beside the skeleton or an error (a failed refresh keeps cached goals, so `goals` alone
            is not enough), and not over the empty state. A completed goal's
            Celebrate plays over it at the same size, so it replaces Piso rather than adding one. */}
        {goals.length > 0 && !isError && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: PISO_SIZE, height: PISO_SIZE }}>
              <Piso state={pisoMoodFor({ bands: [], hasExpenses: true })} size={PISO_SIZE} />
              {celebration ? (
                <View
                  key={celebration}
                  pointerEvents="none"
                  // The Achieved group already says it in text; Celebrate's own Piso would repeat it.
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ position: "absolute", top: 0, left: 0 }}
                >
                  <Celebrate
                    event={celebration}
                    size={PISO_SIZE}
                    onDone={() => setCelebrated((d) => [...d, celebration])}
                  />
                </View>
              ) : null}
            </View>
            <Body dim style={{ flex: 1, fontSize: t.fontSizes.caption }}>
              {active.length === 0
                ? "Every goal reached"
                : `${active.length} ${active.length === 1 ? "goal" : "goals"} in progress`}
            </Body>
          </View>
        )}

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

        {active.map((g, i) => goalCard(g, i, false))}

        {achieved.length > 0 && (
          <View style={{ gap: t.spacing.gap }}>
            <Pressable
              testID="goals-achieved"
              accessibilityRole="button"
              accessibilityLabel={`Achieved (${achieved.length})`}
              accessibilityState={{ expanded: showAchieved }}
              onPress={() => setShowAchieved((v) => !v)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 44,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: t.fontSizes.body, color: t.colors.text2 }}>
                Achieved ({achieved.length})
              </Text>
              <Ionicons
                name={showAchieved ? "chevron-up" : "chevron-down"}
                size={18}
                color={t.colors.text2}
              />
            </Pressable>
            {showAchieved ? achieved.map((g, i) => goalCard(g, i, true)) : null}
          </View>
        )}

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
          // A new goal has no currency yet; the sheet then stays in pesos.
          currency={sheet && sheet.kind !== "create" ? sheet.goal.currency : undefined}
        />
      ) : null}
    </>
  );
}
