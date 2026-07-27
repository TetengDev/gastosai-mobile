import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { listExpenses } from "../../src/api/expenses";
import { formatCurrency, formatDayMonth } from "../../src/lib/formatters";
import { Body, Button, ErrorText } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

export default function Expenses() {
  const router = useRouter();
  const t = useTheme();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["expenses"],
    queryFn: listExpenses,
  });
  const [filter, setFilter] = useState("");

  // Client-side filtering only — this narrows an already-fetched list. Anything that changes a
  // total or a bucket stays on the backend (CLAUDE.md: no business logic on-device).
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
  // different situations and deserve three different messages.
  const emptyMessage = () => {
    if (isLoading || isError) return null;
    if (!hasAny) return "No expenses yet — tap + to add your first one.";
    return `Nothing matches “${filter.trim()}”.`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.page, padding: t.spacing.screen, gap: 12 }}>
      <TextInput
        placeholder="Filter by description or category"
        placeholderTextColor={t.colors.text3}
        value={filter}
        onChangeText={setFilter}
        style={{
          backgroundColor: t.colors.inputBg,
          borderColor: t.colors.borderInput,
          borderWidth: 1,
          borderRadius: t.radii.input,
          color: t.colors.textHi,
          fontFamily: t.fonts.body,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      />

      {isLoading && <ActivityIndicator color={t.colors.text2} />}

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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.colors.text2} />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          emptyMessage() ? (
            <Body dim style={{ paddingVertical: 12 }}>{emptyMessage()}</Body>
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
                paddingVertical: 14,
                borderBottomColor: t.colors.border3,
                borderBottomWidth: 1,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Body numberOfLines={1}>{item.description ?? "-"}</Body>
              <Body dim style={{ fontSize: 12.5 }}>
                {item.category ?? "Uncategorized"} · {formatDayMonth(item.date)}
              </Body>
            </View>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
              {formatCurrency(item.amount ?? 0)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
