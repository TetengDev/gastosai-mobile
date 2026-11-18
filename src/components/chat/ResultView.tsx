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
 * How long one rendered value may be before it is cut (TEN-532). Same cap, and the same cut text,
 * as `MAX_VALUE_CHARS` and `clampText` in `PreviewCard.tsx` (TEN-422), which are not exported.
 */
const MAX_VALUE_CHARS = 200;

function clampText(text: string): string {
  if (text.length <= MAX_VALUE_CHARS) return text;
  return `${text.slice(0, MAX_VALUE_CHARS)}… (+${text.length - MAX_VALUE_CHARS} more characters)`;
}

/**
 * `String()` without its one unbounded case: on an array it joins every element, nested arrays
 * included, before any cap can cut the result. No field this view reads is an array in a real
 * payload, so the count is all that is worth showing.
 */
const str = (v: unknown): string => (Array.isArray(v) ? `(${v.length} items)` : String(v));

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
    <Text style={{ fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text2 }}>{clampText(s)}</Text>
  );
  const value = (s: string) => (
    <Text style={{ fontFamily: t.fonts.display, fontSize: 14, color: t.colors.textHi }}>{clampText(s)}</Text>
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
    // A row that is not an object reads as an empty one: `in` and property reads throw on `null`,
    // and `in` throws on any primitive. `hidden` still counts the original rows.
    const rows = (result.slice(0, MAX_ROWS) as unknown[]).map((r) =>
      r !== null && typeof r === "object" ? (r as Record<string, unknown>) : {},
    );
    const first = rows[0];
    const hidden = result.length - rows.length;

    // Order matters: expenses also carry `category`, so the more specific shape is tested first.
    if ("category" in first && "date" in first) {
      return list(
        rows.map((e, i) =>
          row(
            str(e.id ?? i),
            <>
              {value(str(e.description ?? "-"))}
              {label(
                [e.category ? str(e.category) : null, e.date ? formatDateOnly(str(e.date)) : null]
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
            str(c.category ?? i),
            value(str(c.category ?? "Uncategorized")),
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
            str(g.id ?? i),
            <>
              {value(str(g.name ?? "-"))}
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
          row(str(a.id ?? i), value(str(a.message ?? "-")), label(str(a.severity ?? ""))),
        ),
        hidden,
      );
    }

    if ("name" in first && "id" in first) {
      return list(
        rows.map((c, i) => row(str(c.id ?? i), value(str(c.name ?? "-")), null)),
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
    // `for…in` rather than `Object.entries`, which would build an entry tuple for every key before
    // any cap applied (the engine still enumerates the keys; only value reads and rows are bounded) — the reason `previewFields` in `PreviewCard.tsx` walks this way too. The walk
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
    // `floor` alone still discloses: a walk that ran out before reaching any scalar has hidden
    // whatever comes after, and saying nothing would let the payload suppress it.
    if (entries.length > 0 || floor) {
      return list(
        entries.map(([k, v]) => row(k, label(k), value(String(v)))),
        hidden,
        floor,
      );
    }
  }

  return null;
}
