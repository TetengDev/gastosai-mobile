import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import {
  budgetSummary,
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from "../../src/api/budgets";
import { listCategories } from "../../src/api/categories";
import type { BudgetSummaryItem } from "../../src/api/types";
import { formatCurrency, formatMonth } from "../../src/lib/formatters";
import { useMonth } from "../../src/context/MonthContext";
import BudgetSheet from "../../src/components/BudgetSheet";
import {
  Body,
  Button,
  Card,
  ErrorText,
  MonthStepper,
  Pill,
  ProgressBar,
  RowMenu,
  Skeleton,
  StatTile,
} from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";
import { accents } from "../../src/theme";

/** The backend sets a status per category; map it to a colour rather than re-deriving one. */
function toneColor(status?: string): string {
  if (status === "OVER" || status === "EXCEEDED") return accents.danger;
  if (status === "NEAR" || status === "WARNING") return accents.amber;
  return accents.brand;
}

/**
 * Budgets for the current month — now writable.
 *
 * Two queries back this screen and they are not interchangeable: `/budgets/summary` carries the
 * computed figures (`spent`, `percentUsed`, `safeToSpend`), while `/budgets` carries the
 * definitions with the ids needed to edit one. The summary is what gets rendered; the definitions
 * are only ever used to find which budget a row belongs to.
 *
 * Nothing here recomputes a total after a mutation. Saving invalidates both queries and re-renders
 * whatever the backend returns — advancing a bar locally to feel faster is exactly how a client
 * ends up disagreeing with the server about a number the user is trusting.
 */
export default function Budgets() {
  const t = useTheme();
  const qc = useQueryClient();
  const { month, shiftMonth, isCurrentMonth } = useMonth();

  const summary = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });
  const definitions = useQuery({
    queryKey: ["budgets", "list", month],
    queryFn: () => listBudgets(month),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [editing, setEditing] = useState<BudgetSummaryItem | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["budgets"] });
    setEditing(null);
    setCreating(false);
  };

  const create = useMutation({ mutationFn: createBudget, onSuccess: refresh });
  const update = useMutation({
    mutationFn: ({ id, amountLimit, categoryId }: { id: number; amountLimit: number; categoryId: number }) =>
      updateBudget(id, { amountLimit, categoryId, month }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });

  /** The definition id for a summary row — the summary itself carries only a category id. */
  const budgetIdFor = (categoryId?: number) =>
    (definitions.data ?? []).find((d) => d.categoryId === categoryId)?.id;

  /** Categories without a budget this month; budgeting one twice is a 400 from the API. */
  const unbudgeted = useMemo(() => {
    const taken = new Set((summary.data?.items ?? []).map((i) => i.categoryId));
    return (categories.data ?? []).filter((c) => c.id != null && !taken.has(c.id));
  }, [categories.data, summary.data]);

  const confirmDelete = (item: BudgetSummaryItem) => {
    const id = budgetIdFor(item.categoryId);
    if (id == null) return;
    Alert.alert(
      `Remove the ${item.categoryName} budget?`,
      "Spending in this category stops counting against a limit.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => remove.mutate(id) },
      ],
    );
  };

  const items = summary.data?.items ?? [];
  const pending = create.isPending || update.isPending;
  const mutationError = create.isError
    ? errorMessage(create.error)
    : update.isError
      ? errorMessage(update.error)
      : null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.colors.page }}
        contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={summary.isRefetching}
            onRefresh={() => summary.refetch()}
            tintColor={t.colors.text2}
          />
        }
      >
        <MonthStepper
          label={formatMonth(month)}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          canGoNext={!isCurrentMonth}
        />

        {summary.isLoading && <Skeleton height={140} />}

        {summary.isError && (
          <View style={{ gap: 12 }}>
            <ErrorText>{errorMessage(summary.error, "Could not load your budgets.")}</ErrorText>
            <Button title="Try again" onPress={() => summary.refetch()} />
          </View>
        )}

        {summary.data && (
          <>
            <Card tone="panel">
              <StatTile
                label={formatMonth(summary.data.month ?? month)}
                value={formatCurrency(summary.data.safeToSpend ?? 0)}
                sub={`safe to spend · ${formatCurrency(summary.data.dailyAllowance ?? 0)} per day`}
              />
              <Body dim style={{ fontSize: 12.5, marginTop: 8 }}>
                {formatCurrency(summary.data.totalSpent ?? 0)} of{" "}
                {formatCurrency(summary.data.totalBudgeted ?? 0)} used
              </Body>
            </Card>

            {items.length === 0 ? (
              <Card>
                <Body>No budgets set for this month.</Body>
                <Body dim style={{ fontSize: 12.5 }}>
                  A budget is what turns the total above into “safe to spend”.
                </Body>
                <Button
                  testID="budget-create"
                  title="Set a budget"
                  onPress={() => setCreating(true)}
                />
              </Card>
            ) : (
              items.map((b) => (
                <Card key={b.categoryId ?? b.categoryName}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}
                    >
                      {b.categoryName}
                    </Text>
                    {/* percentUsed comes from the backend — displayed, never recalculated. */}
                    <Pill
                      label={`${Math.round(b.percentUsed ?? 0)}%`}
                      dotColor={toneColor(b.status)}
                    />
                    {/* Secondary actions live here rather than as two text links under every
                        card. With a budget per category that was ten small targets down the
                        screen with nothing ranking them. */}
                    <RowMenu
                      testID={`budget-menu-${b.categoryId}`}
                      title={b.categoryName ?? undefined}
                      actions={[
                        { label: "Edit limit", onPress: () => setEditing(b) },
                        {
                          label: "Remove budget…",
                          destructive: true,
                          onPress: () => confirmDelete(b),
                        },
                      ]}
                    />
                  </View>
                  <ProgressBar percent={b.percentUsed ?? 0} color={toneColor(b.status)} />
                  <Body dim style={{ fontSize: 12.5 }}>
                    {formatCurrency(b.spent ?? 0)} of {formatCurrency(b.budgeted ?? 0)} ·{" "}
                    {formatCurrency(b.remaining ?? 0)} left
                  </Body>


                </Card>
              ))
            )}

            {items.length > 0 && unbudgeted.length > 0 && (
              <Button
                testID="budget-create"
                variant="secondary"
                title="Add a budget"
                onPress={() => setCreating(true)}
              />
            )}
          </>
        )}

        <ErrorText>{remove.isError ? errorMessage(remove.error) : null}</ErrorText>
      </ScrollView>

      {/* Edit takes the category as read — it is the row you tapped — so only the limit changes. */}
      {editing ? (
        <BudgetSheet
          visible
          title={`${editing.categoryName} budget`}
          submitLabel="Save limit"
          initialAmount={editing.budgeted != null ? String(editing.budgeted) : ""}
          categories={[]}
          submitting={pending}
          serverError={mutationError}
          onSubmit={({ amount }) => {
            const id = budgetIdFor(editing.categoryId);
            if (id == null || editing.categoryId == null) return;
            update.mutate({ id, amountLimit: amount, categoryId: editing.categoryId });
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {creating ? (
        <BudgetSheet
          visible
          title="New budget"
          submitLabel="Set budget"
          initialAmount=""
          categories={unbudgeted}
          submitting={pending}
          serverError={mutationError}
          onSubmit={({ amount, categoryId }) => {
            if (categoryId == null) return;
            create.mutate({ amountLimit: amount, categoryId, month });
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </>
  );
}
