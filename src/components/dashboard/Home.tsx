import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ExpenseResponse, GoalResponse } from "../../api/types";
import { Piso, type PisoState } from "../../brand/Piso";
import { formatCentavos, formatDayMonth } from "../../lib/formatters";
import { goalTone, type MeterTone } from "../../lib/pisoMood";
import { useTheme } from "../../theme/useTheme";
import { Celebrate } from "../Celebrate";
import { Amount, Body, Card, ErrorText, ProgressMeter, Skeleton } from "../ui";
import { CategoryBreakdownCard, TopExpensesCard } from "./cards";
import InsightCard from "./InsightCard";
import TrendCard from "./TrendCard";
import type { AttentionRow } from "./homeStatus";

/**
 * Home, spec §4: a hero, "Needs attention", goals, recent, and Insights folded away. The hero is
 * the one loud thing; everything after it is row-size type with no second Piso.
 */

const PISO_SIZE = 96;

function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{ fontFamily: t.fonts.mono, fontSize: t.fontSizes.micro, letterSpacing: 1.3, color: t.colors.text3 }}
    >
      {children}
    </Text>
  );
}

function SeeAll({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={onPress} hitSlop={12}>
      <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: t.fontSizes.control, color: t.colors.link }}>
        See all
      </Text>
    </Pressable>
  );
}

function SectionHead({ label, onSeeAll, testID }: { label: string; onSeeAll?: () => void; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <SectionLabel>{label}</SectionLabel>
      {onSeeAll ? <SeeAll onPress={onSeeAll} testID={testID} /> : null}
    </View>
  );
}

/** The answer to "how is my month going": spend, Piso beside it, the meter and one line. */
export function Hero({
  spent,
  loading,
  sub,
  mood,
  status,
  meter,
  celebrations,
  children,
}: {
  spent: number;
  loading?: boolean;
  sub: string;
  mood: PisoState;
  status: string | null;
  meter: { percent: number; tone: MeterTone; caption: string } | null;
  /** `Celebrate` events whose trigger holds; each plays once, over Piso. */
  celebrations: readonly string[];
  /** The error and empty-month affordances, under the status line. */
  children?: ReactNode;
}) {
  const t = useTheme();
  const heads = mood === "overBudget" || mood === "worried";

  return (
    <Card testID="home-hero" style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          {loading ? <Skeleton height={40} /> : <Amount centavos={spent} size="hero" />}
          <Body dim style={{ fontSize: t.fontSizes.caption }}>
            {sub}
          </Body>
        </View>
        <View style={{ width: PISO_SIZE, height: PISO_SIZE }}>
          <Piso state={mood} size={PISO_SIZE} />
          {/* Drawn over the mood Piso at the same size, so a celebration replaces it rather than
              adding a second one. Hidden from screen readers: Celebrate's own Piso would announce
              twice what the status line already says. */}
          {celebrations.map((event) => (
            <View
              key={event}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              <Celebrate event={event} size={PISO_SIZE} />
            </View>
          ))}
        </View>
      </View>

      {meter ? (
        <View style={{ gap: 6 }}>
          <ProgressMeter percent={meter.percent} tone={meter.tone} label="Month budget" />
          <Body dim style={{ fontSize: t.fontSizes.caption, fontVariant: ["tabular-nums"] }}>
            {meter.caption}
          </Body>
        </View>
      ) : null}

      {status ? (
        <Text
          testID="home-status"
          style={{
            fontFamily: t.fonts.bodySemi,
            fontSize: t.fontSizes.body,
            // Amber for a heads-up, never the danger red: over budget is a warning, not a failure.
            color: heads ? t.colors.warnText : t.colors.text,
          }}
        >
          {status}
        </Text>
      ) : null}

      {children}
    </Card>
  );
}

/** Budgets the server bands as close or over, and bills due within a week. Hidden when empty. */
export function NeedsAttention({ rows }: { rows: readonly AttentionRow[] }) {
  const router = useRouter();
  if (rows.length === 0) return null;

  return (
    <Card testID="needs-attention">
      <SectionLabel>NEEDS ATTENTION</SectionLabel>
      {rows.map((r) => (
        <Pressable
          key={r.key}
          accessibilityRole="button"
          onPress={() => router.push(r.href)}
          style={({ pressed }) => [{ gap: 6, paddingVertical: 6 }, pressed && { opacity: 0.6 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Body numberOfLines={1}>{r.label}</Body>
              <Body dim style={{ fontSize: 12.5 }}>
                {r.sub}
              </Body>
            </View>
            {r.amount != null ? <Amount centavos={r.amount} /> : null}
          </View>
          {r.tone && r.percent != null ? (
            <ProgressMeter percent={r.percent} tone={r.tone} label={`${r.label} budget`} />
          ) : null}
        </Pressable>
      ))}
    </Card>
  );
}

const GOAL_TILE_WIDTH = 168;

/** Savings goals as a row of meters. Good news as they fill, so they never band like a budget. */
export function GoalsStrip({ goals }: { goals: readonly GoalResponse[] }) {
  const t = useTheme();
  const router = useRouter();
  if (goals.length === 0) return null;

  return (
    <View testID="card-goals" style={{ gap: 10 }}>
      <SectionHead label="GOALS" onSeeAll={() => router.push("/(app)/goals")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Bleed to the screen edge so a half-shown tile says "there is more this way".
        style={{ marginHorizontal: -t.spacing.screen }}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, gap: 10 }}
      >
        {goals.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            onPress={() => router.push("/(app)/goals")}
            style={({ pressed }) => [
              {
                width: GOAL_TILE_WIDTH,
                padding: 14,
                gap: 8,
                borderRadius: t.radii.card,
                borderWidth: 1,
                borderColor: t.colors.border,
                backgroundColor: t.colors.surface,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Body numberOfLines={1}>{g.name ?? "Goal"}</Body>
            <ProgressMeter
              percent={g.progressPercent ?? 0}
              tone={goalTone(g.status ?? "ON_TRACK")}
              label={g.name ?? "Goal"}
            />
            <Body dim numberOfLines={1} style={{ fontSize: 12.5, fontVariant: ["tabular-nums"] }}>
              {`${formatCentavos(g.savedAmount ?? 0)} of ${formatCentavos(g.targetAmount ?? 0)}`}
            </Body>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const RECENT_COUNT = 5;

/** The last five expenses. The full list is one tap away on Expenses. */
export function RecentList({
  expenses,
  loading,
  error,
  emptyText,
}: {
  expenses: readonly ExpenseResponse[];
  loading: boolean;
  error: string | null;
  /** Month-aware: an empty month is not an empty account. */
  emptyText: string;
}) {
  const router = useRouter();
  const recent = expenses.slice(0, RECENT_COUNT);

  return (
    <Card>
      <SectionHead label="RECENT" onSeeAll={() => router.push("/(app)/expenses")} testID="recent-see-all" />
      {loading ? <Skeleton height={120} /> : null}
      <ErrorText>{error}</ErrorText>
      {recent.map((e, i) => (
        <Pressable
          key={e.id}
          // Positional, for UI automation: an amount or a description is ambiguous on this screen.
          testID={`recent-row-${i}`}
          accessibilityRole="button"
          onPress={() => router.push(`/(app)/expense/${e.id}`)}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Body numberOfLines={1}>{e.description ?? "-"}</Body>
            <Body dim style={{ fontSize: 12.5 }}>
              {e.category ?? "Uncategorized"} · {formatDayMonth(e.date)}
            </Body>
          </View>
          {/* The base-currency figure: a ¥1,500 expense is not ₱1,500 (docs/lessons.md). */}
          <Amount centavos={e.amountInBaseCurrency ?? e.amount ?? 0} />
        </Pressable>
      ))}
      {!loading && !error && recent.length === 0 ? <Body dim>{emptyText}</Body> : null}
    </Card>
  );
}

/**
 * The report you open on purpose: the AI sentence, the daily trend, the biggest expenses and the
 * category split. Collapsed by default, and nothing inside is fetched until it opens, which also
 * spares the per-user `/ai/**` quota on every glance at Home.
 */
export function Insights({ month }: { month: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: t.spacing.gap }}>
      <Pressable
        testID="insights-toggle"
        accessibilityRole="button"
        accessibilityLabel="Insights"
        accessibilityHint={open ? "Hides the trend, top expenses and insight" : "Shows the trend, top expenses and insight"}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        style={({ pressed }) => [
          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
          pressed && { opacity: 0.6 },
        ]}
      >
        <SectionLabel>INSIGHTS</SectionLabel>
        <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: t.fontSizes.control, color: t.colors.link }}>
          {open ? "Hide" : "Show"}
        </Text>
      </Pressable>
      {open ? (
        <>
          <InsightCard month={month} />
          <TrendCard month={month} />
          <TopExpensesCard month={month} />
          <CategoryBreakdownCard />
        </>
      ) : null}
    </View>
  );
}
