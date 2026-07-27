import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { listExpenses } from "../../src/api/expenses";
import { errorMessage } from "../../src/api/client";
import { formatCurrency, formatDayMonth } from "../../src/lib/formatters";
import { ErrorText, colors } from "../../src/components/ui";

export default function Expenses() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["expenses"],
    queryFn: listExpenses,
  });
  const [filter, setFilter] = useState("");

  // Client-side filtering only — this narrows an already-fetched list. Anything that changes
  // a total or a bucket stays on the backend (CLAUDE.md: no business logic on-device).
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = data ?? [];
    if (!q) return all;
    return all.filter(
      (e) =>
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q),
    );
  }, [data, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 }}>
      <Stack.Screen options={{ title: "Expenses" }} />
      <TextInput
        placeholder="Filter by description or category"
        placeholderTextColor={colors.muted}
        value={filter}
        onChangeText={setFilter}
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          color: colors.text,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />
      {isLoading && <ActivityIndicator color={colors.accent} />}
      <ErrorText>{isError ? errorMessage(error) : null}</ErrorText>
      <FlatList
        data={rows}
        keyExtractor={(e) => String(e.id)}
        ListEmptyComponent={
          isLoading ? null : <Text style={{ color: colors.muted }}>Nothing matches.</Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 10,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {item.description ?? "-"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {item.category ?? "Uncategorized"} · {formatDayMonth(item.date)}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {formatCurrency(item.amount ?? 0)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
