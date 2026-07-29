import { Text, View } from "react-native";
import { formatCurrency, formatDateOnly } from "../../lib/formatters";
import { useTheme } from "../../theme/useTheme";

/**
 * Renders the `result` an assistant action returns.
 *
 * **This is the half that was missing.** `message` is only a caption — "Category totals for
 * 2026-07." — and the data lives in `result`, which this screen used to drop on the floor. Asking
 * "how much do I spend on food" produced a label and nothing else.
 *
 * `result` is typed `{}` in the published contract, so its shape can only be recognised by
 * inspection, exactly as `gastosai-web/src/components/ChatWidget.tsx` does. Duck-typing is not
 * elegant; it is what an untyped field leaves available, and the alternative — rendering nothing
 * for anything unrecognised — is what caused the bug.
 *
 * Unknown shapes therefore fall through to a readable key/value list rather than disappearing, so
 * a new backend action degrades instead of vanishing.
 */
export default function ResultView({ result }: { result: unknown }) {
  const t = useTheme();

  const label = (s: string) => (
    <Text style={{ fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text2 }}>{s}</Text>
  );
  const value = (s: string) => (
    <Text style={{ fontFamily: t.fonts.display, fontSize: 14, color: t.colors.textHi }}>{s}</Text>
  );
  const row = (key: string, left: React.ReactNode, right: React.ReactNode) => (
    <View
      key={key}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        paddingVertical: 5,
      }}
    >
      {/* flexShrink so a long category name wraps inside its own column instead of shoving the
          amount off the row. */}
      <View style={{ flex: 1, flexShrink: 1 }}>{left}</View>
      {right}
    </View>
  );

  // An empty array is a real answer — "nothing matched" — and saying so is the difference between
  // a working feature and one that looks broken. Web uses this exact wording.
  if (Array.isArray(result) && result.length === 0) {
    return <View testID="chat-result">{label("No results found.")}</View>;
  }

  if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as Record<string, unknown>;
    const rows = result as Record<string, unknown>[];

    // Order matters: expenses also carry `category`, so the more specific shape is tested first.
    if ("category" in first && "date" in first) {
      return (
        <View testID="chat-result">
          {rows.map((e, i) =>
            row(
              String(e.id ?? i),
              <>
                {value(String(e.description ?? "-"))}
                {label(
                  [e.category, e.date ? formatDateOnly(String(e.date)) : null]
                    .filter(Boolean)
                    .join(" · "),
                )}
              </>,
              value(formatCurrency(Number(e.amount ?? 0))),
            ),
          )}
        </View>
      );
    }

    if ("category" in first && "total" in first) {
      return (
        <View testID="chat-result">
          {rows.map((c, i) =>
            row(
              String(c.category ?? i),
              value(String(c.category ?? "Uncategorized")),
              value(formatCurrency(Number(c.total ?? 0))),
            ),
          )}
        </View>
      );
    }

    if ("progressPercent" in first) {
      return (
        <View testID="chat-result">
          {rows.map((g, i) =>
            row(
              String(g.id ?? i),
              <>
                {value(String(g.name ?? "-"))}
                {label(
                  `${formatCurrency(Number(g.savedAmount ?? 0))} of ${formatCurrency(Number(g.targetAmount ?? 0))}`,
                )}
              </>,
              value(`${Math.round(Number(g.progressPercent ?? 0))}%`),
            ),
          )}
        </View>
      );
    }

    if ("severity" in first) {
      return (
        <View testID="chat-result">
          {rows.map((a, i) =>
            row(String(a.id ?? i), value(String(a.message ?? "-")), label(String(a.severity ?? ""))),
          )}
        </View>
      );
    }

    if ("name" in first && "id" in first) {
      return (
        <View testID="chat-result">
          {rows.map((c, i) => row(String(c.id ?? i), value(String(c.name ?? "-")), null))}
        </View>
      );
    }
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;

    if ("totalBudgeted" in r) {
      return (
        <View testID="chat-result">
          {row("spent", label("Spent"), value(formatCurrency(Number(r.totalSpent ?? 0))))}
          {row("budgeted", label("Budgeted"), value(formatCurrency(Number(r.totalBudgeted ?? 0))))}
          {row("safe", label("Safe to spend"), value(formatCurrency(Number(r.safeToSpend ?? 0))))}
        </View>
      );
    }

    // Unrecognised object: show it rather than swallow it. Scalars only — nesting a whole object
    // into a row would print "[object Object]", which is worse than omitting the key.
    const entries = Object.entries(r).filter(([, v]) => typeof v !== "object" || v === null);
    if (entries.length > 0) {
      return (
        <View testID="chat-result">
          {entries.map(([k, v]) => row(k, label(k), value(String(v))))}
        </View>
      );
    }
  }

  return null;
}
