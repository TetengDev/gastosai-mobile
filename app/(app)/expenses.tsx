import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { errorMessage } from "../../src/api/client";
import { listExpenses } from "../../src/api/expenses";
import { formatCurrency, formatDayMonth } from "../../src/lib/formatters";
import { Button, ErrorText, colors } from "../../src/components/ui";

export default function Expenses() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
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

  const hasAny = (data ?? []).length > 0;

  // "No expenses yet", "your filter matched nothing" and "the request failed" are three
  // different situations and deserve three different messages — the first version of this
  // screen showed "Nothing matches." for all of them.
  const emptyMessage = () => {
    if (isLoading) return null;
    if (isError) return null;
    if (!hasAny) return "No expenses yet. Add your first one from the dashboard.";
    return `Nothing matches “${filter.trim()}”.`;
  };

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

      {isError && (
        <View style={{ gap: 12 }}>
          <ErrorText>{errorMessage(error, "Could not load your expenses.")}</ErrorText>
          <Button title="Try again" onPress={() => refetch()} />
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(e) => String(e.id)}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          emptyMessage() ? (
            <Text style={{ color: colors.muted, paddingVertical: 12 }}>{emptyMessage()}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/expense/${item.id}`)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              },
              pressed && { opacity: 0.6 },
            ]}
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
          </Pressable>
        )}
      />
    </View>
  );
}
