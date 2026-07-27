import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { budgetSummary } from "../../src/api/budgets";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import { currentMonth, formatCurrency, formatDayMonth, formatMonth } from "../../src/lib/formatters";
import { Body, Button, Card, ErrorText, StatTile } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

export default function Dashboard() {
  const router = useRouter();
  const t = useTheme();
  const month = currentMonth();
  const report = useQuery({ queryKey: ["report", "monthly"], queryFn: monthlyReport });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });
  const budgets = useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => budgetSummary(month),
  });

  // The report is keyed by "YYYY-MM"; find this month's row rather than assuming ordering.
  const thisMonth = report.data?.find((r) => r.month === month);
  const recent = (expenses.data ?? []).slice(0, 5);
  const refreshing = report.isRefetching || expenses.isRefetching || budgets.isRefetching;

  const refreshAll = () => {
    report.refetch();
    expenses.refetch();
    budgets.refetch();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={t.colors.text2} />
      }
    >
      <Stack.Screen options={{ title: "Dashboard" }} />

      <Card>
        {report.isLoading ? (
          <ActivityIndicator color={t.colors.text2} />
        ) : (
          <StatTile
            label={formatMonth(month)}
            value={formatCurrency(thisMonth?.total ?? 0)}
            sub="spent this month"
          />
        )}
        <ErrorText>{report.isError ? errorMessage(report.error) : null}</ErrorText>
      </Card>

      {/* Safe-to-spend is the number most worth seeing on a phone. Server-computed — rendered,
          never recalculated. */}
      {budgets.data ? (
        <Card tone="panel">
          <StatTile
            label="Safe to spend"
            value={formatCurrency(budgets.data.safeToSpend ?? 0)}
            sub={`${formatCurrency(budgets.data.dailyAllowance ?? 0)} per day`}
          />
        </Card>
      ) : null}

      <Button title="Quick add with AI" onPress={() => router.push("/(app)/quick-add")} />
      <Button variant="secondary" title="Add manually" onPress={() => router.push("/(app)/add-expense")} />

      <Card>
        <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
          Recent
        </Text>
        {expenses.isLoading && <ActivityIndicator color={t.colors.text2} />}
        <ErrorText>{expenses.isError ? errorMessage(expenses.error) : null}</ErrorText>
        {recent.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/expense/${e.id}`)}
            style={({ pressed }) => [
              { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Body numberOfLines={1}>{e.description ?? "-"}</Body>
              <Body dim style={{ fontSize: 12.5 }}>
                {e.category ?? "Uncategorized"} · {formatDayMonth(e.date)}
              </Body>
            </View>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
              {formatCurrency(e.amount ?? 0)}
            </Text>
          </Pressable>
        ))}
        {!expenses.isLoading && !expenses.isError && recent.length === 0 && (
          <Body dim>No expenses yet.</Body>
        )}
      </Card>

      <Button variant="secondary" title="All expenses" onPress={() => router.push("/(app)/expenses")} />
      <Button variant="secondary" title="Budgets" onPress={() => router.push("/(app)/budgets")} />
      <Button variant="secondary" title="Goals" onPress={() => router.push("/(app)/goals")} />
      <Button variant="ghost" title="Settings" onPress={() => router.push("/(app)/settings")} />
    </ScrollView>
  );
}
