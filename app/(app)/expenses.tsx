import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { dailyReport, listExpenses } from "../../src/api/expenses";
import type { ExpenseResponse } from "../../src/api/types";
import { useMonth } from "../../src/context/MonthContext";
import {
  expenseAmounts,
  formatCurrency,
  formatDateOnly,
  formatMonth,
  monthRange,
} from "../../src/lib/formatters";
import {
  Body,
  Button,
  ErrorText,
  MonthStepper,
  SearchField,
  Skeleton,
} from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

interface DaySection {
  /** `YYYY-MM-DD`, straight from the expense's own date. */
  day: string;
  /** Server-computed day total, or null when the report has no row for this day. */
  total: number | null;
  data: ExpenseResponse[];
}

export default function Expenses() {
  const router = useRouter();
  const t = useTheme();
  const { month, shiftMonth, isCurrentMonth } = useMonth();
  const range = monthRange(month);

  const expenses = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => listExpenses(range),
  });

  /**
   * Per-day totals, fetched rather than derived.
   *
   * Summing the rows in this component would be two lines and would be a business calculation on
   * the device — the thing CLAUDE.md §1.2 rules out. `/expenses/report/daily` exists for exactly
   * this, so the header figures agree with every other client by construction.
   */
  const daily = useQuery({
    queryKey: ["report", "daily", month],
    queryFn: () => dailyReport(month),
  });

  const [filter, setFilter] = useState("");

  /**
   * Group the month's expenses by day, newest first.
   *
   * Grouping and filtering are presentation over an already-fetched list, which the invariant
   * allows; the *total* on each header is not, and comes from `daily` above. When the report has
   * no row for a day the header simply omits the figure rather than inventing one.
   */
  const sections = useMemo<DaySection[]>(() => {
    const q = filter.trim().toLowerCase();
    const rows = (expenses.data ?? []).filter(
      (e) =>
        !q ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q),
    );

    const totalByDay = new Map<string, number>();
    for (const d of daily.data ?? []) {
      if (d.date) totalByDay.set(d.date, d.total ?? 0);
    }

    const byDay = new Map<string, ExpenseResponse[]>();
    for (const e of rows) {
      // The API serves `2026-06-26T01:00:00+08:00`; the date part is already Manila-local, so
      // slicing it is correct and avoids re-deriving a day in the device's timezone.
      const day = (e.date ?? "").slice(0, 10);
      if (!day) continue;
      const bucket = byDay.get(day);
      if (bucket) bucket.push(e);
      else byDay.set(day, [e]);
    }

    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, data]) => ({
        day,
        // Only meaningful with no filter applied — a filtered list is a subset, and showing the
        // day's full total beside three of its ten rows would read as an error.
        total: q ? null : (totalByDay.get(day) ?? null),
        data,
      }));
  }, [expenses.data, daily.data, filter]);

  const hasAny = (expenses.data ?? []).length > 0;

  const emptyMessage = () => {
    if (expenses.isLoading || expenses.isError) return null;
    if (!hasAny) return `Nothing recorded in ${formatMonth(month)}.`;
    return `Nothing matches “${filter.trim()}”.`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.page, padding: t.spacing.screen, gap: 12 }}>
      <MonthStepper
        label={formatMonth(month)}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        canGoNext={!isCurrentMonth}
      />

      <SearchField
        testID="expense-search"
        value={filter}
        onChangeText={setFilter}
        placeholder="Search this month"
      />

      {expenses.isLoading && <Skeleton height={160} />}

      {expenses.isError && (
        <View style={{ gap: 12 }}>
          <ErrorText>{errorMessage(expenses.error, "Could not load your expenses.")}</ErrorText>
          <Button title="Try again" onPress={() => expenses.refetch()} />
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(e) => String(e.id)}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={expenses.isRefetching}
            onRefresh={() => {
              expenses.refetch();
              daily.refetch();
            }}
            tintColor={t.colors.text2}
          />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          emptyMessage() ? (
            <Body dim style={{ paddingVertical: 12 }}>
              {emptyMessage()}
            </Body>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View
            testID={`day-header-${section.day}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: t.colors.page,
              paddingTop: 14,
              paddingBottom: 6,
            }}
          >
            <Text
              style={{
                fontFamily: t.fonts.mono,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: t.colors.text2,
              }}
            >
              {formatDateOnly(section.day)}
            </Text>
            {section.total != null ? (
              <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 12.5, color: t.colors.text2 }}>
                {formatCurrency(section.total)}
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          // Peso figure from the converted field, so a row and its day header agree.
          const { base, original } = expenseAmounts(item);
          return (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/expense/${item.id}`)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomColor: t.colors.border3,
                borderBottomWidth: 1,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Body numberOfLines={1}>{item.description ?? "-"}</Body>
              <Body dim style={{ fontSize: 12.5 }}>
                {item.category ?? "Uncategorized"}
                {original ? ` · ${original}` : ""}
              </Body>
            </View>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
              {formatCurrency(base)}
            </Text>
          </Pressable>
          );
        }}
      />
    </View>
  );
}
