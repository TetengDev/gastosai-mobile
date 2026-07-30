import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { dailyReport } from "../../api/expenses";
import { monthlyComparison } from "../../api/reports";
import { currentMonth, formatCurrency } from "../../lib/formatters";
import { Body, Card, MiniBars, Skeleton } from "../ui";
import { useTheme } from "../../theme/useTheme";

/**
 * A bar per day, with this month against the last.
 *
 * The query key is the same one `app/(app)/expenses.tsx` uses for its section-header totals, so
 * opening Home and then Expenses costs one request rather than two.
 *
 * `changePercent` comes from `/expenses/report/monthly-comparison`. Working it out here from the
 * two totals would be trivial and would put a number the user reads behind client arithmetic —
 * the backend already publishes it.
 */
export default function TrendCard({ month }: { month: string }) {
  const t = useTheme();

  const daily = useQuery({
    queryKey: ["report", "daily", month],
    queryFn: () => dailyReport(month),
  });
  const comparison = useQuery({
    queryKey: ["report", "comparison", month],
    queryFn: () => monthlyComparison(month),
  });

  if (daily.isLoading) return <Skeleton height={120} />;

  const rows = daily.data ?? [];
  if (rows.length === 0) return null;

  // Ordered by date so the bars read left-to-right as the month progressed. Sorting a fetched list
  // is presentation; none of the values are touched.
  const ordered = [...rows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const change = comparison.data?.changePercent;
  const up = (change ?? 0) > 0;

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: t.fonts.mono,
            fontSize: 11,
            letterSpacing: 1.3,
            color: t.colors.text3,
          }}
        >
          DAILY SPEND
        </Text>
        {change != null ? (
          <Text
            testID="trend-change"
            style={{
              fontFamily: t.fonts.bodyMedium,
              fontSize: 12.5,
              // Spending more than last month is the unwelcome direction, so it takes the warning
              // colour — not the "up is good" reading a growth chart would imply.
              color: up ? t.colors.warnText : t.colors.brand,
            }}
          >
            {up ? "↑" : "↓"} {Math.abs(change).toFixed(2)}% vs last month
          </Text>
        ) : null}
      </View>

      <MiniBars
        values={ordered.map((d) => d.total ?? 0)}
        highlightLast={month === currentMonth()}
      />

      {comparison.data ? (
        <Body dim style={{ fontSize: 12.5 }}>
          {formatCurrency(comparison.data.currentTotal ?? 0)} this month ·{" "}
          {formatCurrency(comparison.data.previousTotal ?? 0)} last
        </Body>
      ) : null}
    </Card>
  );
}
