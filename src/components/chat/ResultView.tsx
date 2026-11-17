import { Text, View } from "react-native";
import { formatCentavos, formatDateOnly } from "../../lib/formatters";
import { centavosOf } from "../money";
import { useTheme } from "../../theme/useTheme";

/**
 * Rows a list renders before it stops and discloses the rest (TEN-429). Same cap, and same reason,
 * as `MAX_ROWS` in `PreviewCard.tsx` (TEN-422): `result` is shaped by the same promptable AI flow.
 */
const MAX_ROWS = 40;

/** How many hidden keys the object fallback walks past the cap before its count becomes a floor. */
const MAX_COUNTED = 5_000;

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
  const row = (key: string, left: React.ReactNode, right: React.ReactNode, testID?: string) => (
    <View
      key={key}
      testID={testID}
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

  // At most `MAX_ROWS` rows, then one row saying how many were cut. `hidden` is always a count of
  // the payload's structure (array length, keys walked), never a value read out of it, so chat
  // content cannot forge or suppress the disclosure. The disclosure sits outside the mapped array,
  // so no payload-derived key can collide with its own.
  const list = (rows: React.ReactNode[], hidden: number, floor = false) => (
    <View testID="chat-result">
      {rows}
      {hidden > 0 || floor
        ? row(
            "more",
            label(floor ? `+${hidden} or more` : `+${hidden} more`),
            label("not shown"),
            "chat-result-more",
          )
        : null}
    </View>
  );

  // An empty array is a real answer — "nothing matched" — and saying so is the difference between
  // a working feature and one that looks broken. Web uses this exact wording.
  if (Array.isArray(result) && result.length === 0) {
    return <View testID="chat-result">{label("No results found.")}</View>;
  }

  if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as Record<string, unknown>;
    const rows = (result as Record<string, unknown>[]).slice(0, MAX_ROWS);
    const hidden = result.length - rows.length;

    // Order matters: expenses also carry `category`, so the more specific shape is tested first.
    if ("category" in first && "date" in first) {
      return list(
        rows.map((e, i) =>
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
            value(formatCentavos(centavosOf(e.amount))),
          ),
        ),
        hidden,
      );
    }

    if ("category" in first && "total" in first) {
      return list(
        rows.map((c, i) =>
          row(
            String(c.category ?? i),
            value(String(c.category ?? "Uncategorized")),
            value(formatCentavos(centavosOf(c.total))),
          ),
        ),
        hidden,
      );
    }

    if ("progressPercent" in first) {
      return list(
        rows.map((g, i) =>
          row(
            String(g.id ?? i),
            <>
              {value(String(g.name ?? "-"))}
              {label(
                `${formatCentavos(centavosOf(g.savedAmount))} of ${formatCentavos(centavosOf(g.targetAmount))}`,
              )}
            </>,
            value(`${Math.round(Number(g.progressPercent ?? 0))}%`),
          ),
        ),
        hidden,
      );
    }

    if ("severity" in first) {
      return list(
        rows.map((a, i) =>
          row(String(a.id ?? i), value(String(a.message ?? "-")), label(String(a.severity ?? ""))),
        ),
        hidden,
      );
    }

    if ("name" in first && "id" in first) {
      return list(
        rows.map((c, i) => row(String(c.id ?? i), value(String(c.name ?? "-")), null)),
        hidden,
      );
    }
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;

    if ("totalBudgeted" in r) {
      return (
        <View testID="chat-result">
          {row("spent", label("Spent"), value(formatCentavos(centavosOf(r.totalSpent))))}
          {row("budgeted", label("Budgeted"), value(formatCentavos(centavosOf(r.totalBudgeted))))}
          {row("safe", label("Safe to spend"), value(formatCentavos(centavosOf(r.safeToSpend))))}
        </View>
      );
    }

    // Unrecognised object: show it rather than swallow it. Scalars only — nesting a whole object
    // into a row would print "[object Object]", which is worse than omitting the key.
    //
    // `for…in` rather than `Object.entries`, which would materialise every key and value before any
    // cap applied — the reason `previewFields` in `PreviewCard.tsx` walks this way too. The walk
    // keeps counting past the cap so the disclosure can say how many keys were cut, but stops after
    // `MAX_COUNTED` more keys (nested ones included, so a wide object of objects is bounded too),
    // and the count then reads as a floor.
    const entries: [string, unknown][] = [];
    let hidden = 0;
    let visited = 0;
    let floor = false;
    for (const k in r) {
      if (visited++ >= MAX_ROWS + MAX_COUNTED) {
        floor = true;
        break;
      }
      const v = r[k];
      if (typeof v === "object" && v !== null) continue;
      if (entries.length < MAX_ROWS) entries.push([k, v]);
      else hidden++;
    }
    if (entries.length > 0) {
      return list(
        entries.map(([k, v]) => row(k, label(k), value(String(v)))),
        hidden,
        floor,
      );
    }
  }

  return null;
}
