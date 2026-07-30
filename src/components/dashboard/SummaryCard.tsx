import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Body, Card } from "../ui";
import { useTheme } from "../../theme/useTheme";

export interface SummaryRow {
  key: string;
  label: string;
  sub?: string | null;
  value: string;
  /** Rendered under the row — a progress bar, for the cards that have one. */
  extra?: ReactNode;
}

/**
 * The shape four dashboard cards share: a titled card, a short list, an optional link to the tab
 * that holds the full version.
 *
 * Extracted because upcoming bills, budget overview, top expenses and goal progress differ only in
 * where their rows come from. Four hand-written near-copies is how they drift apart — one gaining
 * an empty state, another not.
 *
 * Renders nothing when there are no rows. A dashboard card that says "no data" for a feature the
 * user has not set up is noise on the one screen that should be scannable.
 */
export default function SummaryCard({
  title,
  rows,
  footer,
  onFooterPress,
  testID,
}: {
  title: string;
  rows: SummaryRow[];
  /** e.g. "See all budgets" — omitted when there is nowhere more to go. */
  footer?: string;
  onFooterPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  if (rows.length === 0) return null;

  return (
    <Card testID={testID}>
      <Text
        style={{ fontFamily: t.fonts.mono, fontSize: 11, letterSpacing: 1.3, color: t.colors.text3 }}
      >
        {title}
      </Text>

      {rows.map((r) => (
        <View key={r.key} style={{ gap: 6, paddingVertical: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Body numberOfLines={1}>{r.label}</Body>
              {r.sub ? (
                <Body dim style={{ fontSize: 12.5 }}>
                  {r.sub}
                </Body>
              ) : null}
            </View>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
              {r.value}
            </Text>
          </View>
          {r.extra}
        </View>
      ))}

      {footer && onFooterPress ? (
        <Pressable accessibilityRole="button" onPress={onFooterPress} hitSlop={8}>
          <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.link }}>
            {footer}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
