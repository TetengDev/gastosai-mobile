import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import { currentMonth, formatCurrency, formatDayMonth, formatMonth } from "../../src/lib/formatters";
import { Button, Card, ErrorText, colors } from "../../src/components/ui";

export default function Dashboard() {
  const router = useRouter();
  const report = useQuery({ queryKey: ["report", "monthly"], queryFn: monthlyReport });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });

  const month = currentMonth();
  // The report is keyed by "YYYY-MM"; find this month's row rather than assuming ordering.
  const thisMonth = report.data?.find((r) => r.month === month);
  const recent = (expenses.data ?? []).slice(0, 5);
  const refreshing = report.isRefetching || expenses.isRefetching;

  const refreshAll = () => {
    report.refetch();
    expenses.refetch();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
      }
    >
      <Stack.Screen options={{ title: "Dashboard" }} />

      <Card>
        <Text style={{ color: colors.muted }}>{formatMonth(month)}</Text>
        {report.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: "700" }}>
            {formatCurrency(thisMonth?.total ?? 0)}
          </Text>
        )}
        <ErrorText>{report.isError ? errorMessage(report.error) : null}</ErrorText>
      </Card>

      <Button title="Quick add with AI" onPress={() => router.push("/(app)/quick-add")} />
      <Button variant="ghost" title="Add manually" onPress={() => router.push("/(app)/add-expense")} />

      <Card>
        <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 4 }}>Recent</Text>
        {expenses.isLoading && <ActivityIndicator color={colors.accent} />}
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
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {e.description ?? "-"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {e.category ?? "Uncategorized"} · {formatDayMonth(e.date)}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {formatCurrency(e.amount ?? 0)}
            </Text>
          </Pressable>
        ))}
        {!expenses.isLoading && !expenses.isError && recent.length === 0 && (
          <Text style={{ color: colors.muted }}>No expenses yet.</Text>
        )}
      </Card>

      <Button variant="ghost" title="See all expenses" onPress={() => router.push("/(app)/expenses")} />
      <Button variant="ghost" title="Budgets" onPress={() => router.push("/(app)/budgets")} />
      <Button variant="ghost" title="Goals" onPress={() => router.push("/(app)/goals")} />
      <Button variant="ghost" title="Settings" onPress={() => router.push("/(app)/settings")} />
    </ScrollView>
  );
}
