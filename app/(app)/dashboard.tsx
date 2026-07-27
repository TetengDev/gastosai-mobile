import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { listExpenses, monthlyReport } from "../../src/api/expenses";
import { errorMessage } from "../../src/api/client";
import { formatCurrency, formatDayMonth, formatMonth, currentMonth } from "../../src/lib/formatters";
import { Button, Card, ErrorText, colors } from "../../src/components/ui";

export default function Dashboard() {
  const report = useQuery({ queryKey: ["report", "monthly"], queryFn: monthlyReport });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });

  const month = currentMonth();
  // The report is keyed by "YYYY-MM"; find this month's row rather than assuming ordering.
  const thisMonth = report.data?.find((r) => r.month === month);
  const recent = (expenses.data ?? []).slice(0, 5);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
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

      <Link href="/(app)/add-expense" asChild>
        <View>
          <Button title="Add expense" onPress={() => {}} />
        </View>
      </Link>

      <Card>
        <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 4 }}>Recent</Text>
        {expenses.isLoading && <ActivityIndicator color={colors.accent} />}
        <ErrorText>{expenses.isError ? errorMessage(expenses.error) : null}</ErrorText>
        {recent.map((e) => (
          <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {e.description ?? "-"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {e.category ?? "Uncategorized"} · {formatDayMonth(e.date)}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{formatCurrency(e.amount ?? 0)}</Text>
          </View>
        ))}
        {!expenses.isLoading && recent.length === 0 && (
          <Text style={{ color: colors.muted }}>No expenses yet.</Text>
        )}
      </Card>

      <Link href="/(app)/expenses" asChild>
        <View>
          <Button variant="ghost" title="See all expenses" onPress={() => {}} />
        </View>
      </Link>
      <Link href="/(app)/settings" asChild>
        <View>
          <Button variant="ghost" title="Settings" onPress={() => {}} />
        </View>
      </Link>
    </ScrollView>
  );
}
