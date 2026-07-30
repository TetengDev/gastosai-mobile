import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { monthSummary, topCategoryInsight } from "../../api/insights";
import { formatCurrency } from "../../lib/formatters";
import { Body, Card, Skeleton } from "../ui";
import { useTheme } from "../../theme/useTheme";

/**
 * The sentence web leads its dashboard with, plus the month's dominant category.
 *
 * Placed high because it is the only card that *interprets* rather than lists — "38.71% lower than
 * your previous month" answers the question a glance is actually asking.
 *
 * Renders nothing when the insight is unavailable. `src/api/insights.ts` turns 402 (no AI key) and
 * 429 (quota) into `null`, and a dashboard missing one card reads as fine, while an error box about
 * a feature the user never invoked reads as broken.
 */
export default function InsightCard({ month }: { month: string }) {
  const t = useTheme();
  const router = useRouter();

  const summary = useQuery({
    queryKey: ["insight", "month-summary", month],
    queryFn: () => monthSummary(month),
    // The text is generated and cached server-side; re-asking on every focus wastes quota.
    staleTime: 5 * 60_000,
    retry: false,
  });
  const top = useQuery({
    queryKey: ["insight", "top-category", month],
    queryFn: () => topCategoryInsight(month),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (summary.isLoading) return <Skeleton height={96} />;
  if (!summary.data?.summary) return null;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          style={{
            fontFamily: t.fonts.mono,
            fontSize: 11,
            letterSpacing: 1.3,
            color: t.colors.text3,
          }}
        >
          INSIGHT
        </Text>
      </View>

      <Body>{summary.data.summary}</Body>

      {top.data?.category ? (
        <Body dim style={{ fontSize: 12.5 }}>
          Biggest category: {top.data.category} · {formatCurrency(top.data.total ?? 0)} ·{" "}
          {Math.round(top.data.percentOfMonthTotal ?? 0)}% of the month
        </Body>
      ) : null}

      {/* A follow-up question is the natural next move, and chat is the thing that answers it. */}
      <Pressable
        testID="insight-ask"
        accessibilityRole="button"
        onPress={() => router.push("/(app)/more/chat")}
        hitSlop={8}
      >
        <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.link }}>
          Ask about this
        </Text>
      </Pressable>
    </Card>
  );
}
