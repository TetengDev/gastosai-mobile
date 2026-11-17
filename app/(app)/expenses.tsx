import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { dailyReport, listExpenses } from "../../src/api/expenses";
import type { ExpenseResponse } from "../../src/api/types";
import { useMonth } from "../../src/context/MonthContext";
import { formatDateOnly, formatMonth, monthRange } from "../../src/lib/formatters";
import { expenseAmountText } from "../../src/components/money";
import {
  Amount,
  Body,
  Button,
  EmptyState,
  ErrorText,
  MonthStepper,
  SearchField,
  Skeleton,
} from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

/**
 * Default icon per predefined category name — the Ionicons twin of web's
 * `CATEGORY_NAME_ICON_MAP` (`gastosai-web/src/lib/categoryIcon.ts`). A user-made category falls
 * back to the tag, as it does on web.
 */
const CATEGORY_ICON: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  "Cleaning Essentials": "sparkles-outline",
  Date: "heart-outline",
  Extras: "cube-outline",
  "Family Contributions": "people-outline",
  "Hygiene Essentials": "water-outline",
  "Meal Plan": "restaurant-outline",
  "Monthly Personal": "wallet-outline",
  "Monthly Utilities": "flash-outline",
  "Training/Upskilling": "school-outline",
  "Transaction Fees": "card-outline",
  Transportation: "car-outline",
  Vacation: "airplane-outline",
};

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

  // The most recent expense in view — what a flow that just created one needs to reach.
  const newestId = sections[0]?.data[0]?.id;

  const hasAny = (expenses.data ?? []).length > 0;

  const emptyList = () => {
    if (expenses.isLoading || expenses.isError) return null;
    if (!hasAny) {
      return (
        <EmptyState
          title={`Nothing in ${formatMonth(month)} yet`}
          body="Record a spend the moment it happens and it lands here, grouped by day."
          action={{ label: "Log your first expense", onPress: () => router.push("/(app)/quick-add") }}
        />
      );
    }
    return <Body dim style={{ paddingVertical: 12 }}>{`Nothing matches “${filter.trim()}”.`}</Body>;
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
        ListEmptyComponent={emptyList()}
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
            {section.total != null ? <Amount centavos={section.total} size="inline" /> : null}
          </View>
        )}
        renderItem={({ item }) => {
          // Peso figure from the converted field, so a row and its day header agree.
          const { base, original } = expenseAmountText(item);
          const category = item.category ?? "Uncategorized";
          return (
          <Pressable
            // Addressable by id, plus a stable handle on the newest row.
            //
            // Text is not usable here: a row collapses to one accessibility node
            // ("Lunch, Meal Plan, ₱177.00") and its *day header* shows the same amount whenever
            // that expense is the day's only one — so matching the amount hits the header, which
            // is not pressable, and the tap silently does nothing.
            testID={item.id === newestId ? "expense-row-first" : `expense-row-${item.id}`}
            accessibilityRole="button"
            // The category is only an icon now, so it has to be spoken.
            accessibilityLabel={[item.description ?? "-", category, base, original]
              .filter(Boolean)
              .join(", ")}
            onPress={() => router.push(`/(app)/expense/${item.id}`)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                minHeight: 44,
                borderBottomColor: t.colors.border3,
                borderBottomWidth: 1,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name={CATEGORY_ICON[category] ?? "pricetag-outline"} size={18} color={t.colors.text2} />
            <Body numberOfLines={1} style={{ flex: 1 }}>
              {item.description ?? "-"}
            </Body>
            <View style={{ alignItems: "flex-end" }}>
              <Amount centavos={item.amountInBaseCurrency ?? item.amount ?? 0} />
              {original ? (
                <Body dim style={{ fontSize: t.fontSizes.micro }}>
                  {original}
                </Body>
              ) : null}
            </View>
          </Pressable>
          );
        }}
      />
    </View>
  );
}
