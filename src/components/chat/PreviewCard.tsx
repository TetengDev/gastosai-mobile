import { Text, View } from "react-native";
import { Body, Button } from "../ui";
import { actionLabel, isDestructive } from "./chatActions";
import { useTheme } from "../../theme/useTheme";

export interface ActionPreview {
  toolName: string;
  params: Record<string, unknown>;
}

/** One rendered row of a preview's params: a path into `params`, and a readable value. */
export interface PreviewField {
  key: string;
  value: string;
  /**
   * Set only on the disclosure row the breadth cap appends. The card keys off it to refuse the
   * confirm, so it is the one row that is not a path into `params`.
   */
  elided?: true;
}

/**
 * How deep a path is expanded before the remainder is shown as JSON.
 *
 * `params` is server-sent JSON, so it cannot be cyclic, but a pathological depth would otherwise
 * produce one row per leaf of an arbitrarily large tree. Four levels covers anything a tool call
 * plausibly carries; past that the JSON text is still readable, which is all the card promises.
 */
const MAX_DEPTH = 4;

/**
 * How many rows the card renders before it stops and discloses the rest (TEN-422).
 *
 * `MAX_DEPTH` caps depth but not breadth, so a wide object or a long array of objects produced one
 * row per leaf with no ceiling — a few thousand of them freezes the confirm screen. `params` comes
 * from the user's own authenticated chat turn, but the model that proposes it is promptable, so the
 * shape is reachable without a second tenant being involved.
 *
 * Forty is far past anything a real tool call carries (the widest today is five) and far short of
 * what costs a frame to render, so the cap is only ever hit by a payload that is already wrong.
 */
const MAX_ROWS = 40;

/** How long one rendered value may be before it is cut — see `clampText`. */
const MAX_VALUE_CHARS = 200;

function isScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object";
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

/**
 * One value, cut to a length a row can lay out, with the cut stated in the text.
 *
 * A silent cut would be TEN-377's bug in a new shape — the value is still sent whole — so the
 * remainder is counted on screen rather than dropped. Unlike a cut *row*, a cut value still shows
 * the user what kind of value it is and where it starts, so it does not block the confirm.
 */
function clampText(text: string): string {
  if (text.length <= MAX_VALUE_CHARS) return text;
  return `${text.slice(0, MAX_VALUE_CHARS)}… (+${text.length - MAX_VALUE_CHARS} more characters)`;
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "—";
  } catch {
    return "(unreadable)";
  }
}

/**
 * A list of scalars as one row, built up to the value cap rather than joined and then cut.
 *
 * Joining first would materialise the whole list — a megabyte of text for the payload this cap
 * exists to survive — only to throw almost all of it away.
 */
function scalarListText(items: unknown[]): string {
  const parts: string[] = [];
  let chars = 0;
  for (let i = 0; i < items.length; i += 1) {
    const part = scalarText(items[i]);
    // The count of what is left is part of the budget, so `clampText` never cuts the disclosure
    // off the end of the very row that exists to carry it.
    const rest = `… (+${items.length - i} of ${items.length} not shown)`;
    if (chars + part.length + rest.length > MAX_VALUE_CHARS) {
      return `${parts.join(", ")}${rest}`;
    }
    parts.push(part);
    chars += part.length + 2;
  }
  return parts.join(", ");
}

/** Rows gathered so far, plus the number the row cap kept off the screen. */
interface Rows {
  fields: PreviewField[];
  elided: number;
  /** Set when `MAX_COUNTED` stopped the walk, so the count is a floor and not a total. */
  capped: boolean;
}

/**
 * How many leaves are visited before the walk itself stops.
 *
 * Capping rows alone throttles the cost rather than bounding it: counting a leaf is O(1), but a
 * payload with a million of them still costs a million calls on the main thread before the capped
 * card appears. Past this the walk stops and the disclosure says "or more" — a count that is a
 * floor is honest, and the card refuses the confirm either way, so nothing hangs on it being exact.
 */
const MAX_COUNTED = 5_000;

function emit(out: Rows, key: string, value: string): void {
  if (out.fields.length >= MAX_ROWS) {
    out.elided += 1;
    if (out.elided >= MAX_COUNTED) out.capped = true;
    return;
  }
  out.fields.push({ key, value: clampText(value) });
}

function flatten(value: unknown, key: string, depth: number, out: Rows): void {
  if (out.capped) return;
  // `String(value)` is only ever reached for a non-object, so "[object Object]" cannot be produced.
  if (isScalar(value)) {
    emit(out, key, scalarText(value));
    return;
  }
  if (depth >= MAX_DEPTH) {
    emit(out, key, jsonText(value));
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      emit(out, key, "(none)");
      return;
    }
    // A list of ids or dates reads better as one row than as one row per index.
    if (value.every(isScalar)) {
      emit(out, key, scalarListText(value));
      return;
    }
    // The walk continues past the row cap so the disclosure row can say how many rows are missing
    // — counting a leaf is cheap, rendering one is not — but it stops at `MAX_COUNTED`, so a
    // pathological length costs a bounded number of iterations and not one per element.
    for (let i = 0; i < value.length && !out.capped; i += 1) {
      flatten(value[i], `${key}[${i}]`, depth + 1, out);
    }
    return;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    emit(out, key, "(none)");
    return;
  }
  for (const [k, v] of entries) {
    if (out.capped) return;
    flatten(v, `${key}.${k}`, depth + 1, out);
  }
}

/**
 * Every value in `params`, flattened to readable rows — nothing is dropped.
 *
 * The card used to filter out anything that was not a scalar, because a nested value rendered as
 * "[object Object]". But `confirmChatAction` sends `params` **whole**, so a filtered value was
 * still executed — approved by a user who was never shown it (TEN-377). Every tool the assistant
 * can propose today takes scalars only, so nothing was being hidden yet; the first tool that
 * carries a date range, an id list or a filter object would have hidden it silently.
 *
 * So a nested value is expanded instead: `{ range: { from, to } }` becomes `range.from` and
 * `range.to`. `[object Object]` is what the old filter existed to prevent and it must not come
 * back — `String()` is called only on non-objects, and the two fallbacks (depth cap, empty
 * container) are JSON text and "(none)".
 *
 * Bounded in both directions (TEN-422): at most `MAX_ROWS` rows, each at most `MAX_VALUE_CHARS`
 * long. Whatever a bound elides is stated on screen — a trailing row counting the rows that are
 * missing, and `… (+N more …)` inside a value — never dropped quietly, because the payload is
 * still sent whole. The trailing row also carries `elided`, which makes `PreviewCard` refuse the
 * confirm: a row the user cannot read is a parameter they cannot approve.
 *
 * The walk is bounded too (`MAX_COUNTED`), so the work is bounded and not merely the output; past
 * that the trailing row reads `+N or more`.
 */
export function previewFields(params: Record<string, unknown>): PreviewField[] {
  const out: Rows = { fields: [], elided: 0, capped: false };
  for (const [k, v] of Object.entries(params)) {
    if (out.capped) break;
    flatten(v, k, 0, out);
  }
  if (out.elided > 0) {
    out.fields.push({
      key: out.capped ? `+${out.elided} or more` : `+${out.elided} more`,
      value: "not shown",
      elided: true,
    });
  }
  return out.fields;
}

/**
 * What the assistant proposes to do, and the confirmation it waits for.
 *
 * `type: "preview"` means the backend has parsed an intent to *write* and is asking first. Mobile
 * used to render the message as plain text, so the proposal was shown and the write never
 * happened — "add lunch 150" appeared to work and did nothing.
 *
 * **Never auto-confirms.** The same rule the AI capture flow follows: a model can be wrong, and a
 * silently created wrong record is worse than no record. The user reads the parameters and decides.
 *
 * And reads *all* of them — `confirmChatAction` sends `params` whole, so every entry is rendered
 * (`previewFields`) rather than filtered down to the scalars.
 *
 * When a payload is too wide to render that way, the card says so and **offers no confirm** rather
 * than showing a partial list beside a working button (TEN-422). Only Cancel is left: a parameter
 * the card cannot show is one the user cannot approve, and no real tool call reaches the cap.
 */
export default function PreviewCard({
  preview,
  confirmed,
  pending,
  onConfirm,
  onCancel,
}: {
  preview: ActionPreview;
  /** Once confirmed the buttons are replaced, so a double-tap cannot fire the action twice. */
  confirmed: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const destructive = isDestructive(preview.toolName);

  // Everything in `params`, because everything in `params` is what gets sent. See `previewFields`.
  const fields = previewFields(preview.params);
  const incomplete = fields.some((f) => f.elided);

  return (
    <View
      testID="chat-preview"
      style={{
        backgroundColor: t.colors.surface2,
        borderColor: destructive ? t.colors.danger : t.colors.border,
        borderWidth: 1,
        borderRadius: t.radii.card,
        padding: 14,
        gap: 8,
      }}
    >
      <Text
        style={{
          fontFamily: t.fonts.mono,
          fontSize: 11,
          letterSpacing: 1.2,
          color: destructive ? t.colors.danger : t.colors.text3,
        }}
      >
        {actionLabel(preview.toolName).toUpperCase()}
      </Text>

      {fields.map(({ key, value, elided }) => (
        <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Body dim style={{ fontSize: 13 }}>
            {key}
          </Body>
          {/* `flexShrink` so an expanded path's value wraps instead of pushing off the card. */}
          <Text
            style={{
              flexShrink: 1,
              textAlign: "right",
              fontFamily: t.fonts.display,
              fontSize: 14,
              color: elided ? t.colors.danger : t.colors.textHi,
            }}
          >
            {value}
          </Text>
        </View>
      ))}

      {confirmed ? (
        <Body dim style={{ fontSize: 12.5 }}>
          Done.
        </Body>
      ) : incomplete ? (
        // No confirm button at all, so the partial list cannot be approved by a tap. See the
        // component doc.
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text testID="chat-preview-incomplete" style={{ fontSize: 12.5, color: t.colors.danger }}>
            This action carries more parameters than can be shown, so it cannot be confirmed here.
            Cancel and ask for a smaller change.
          </Text>
          <Button testID="chat-cancel" size="sm" variant="secondary" title="Cancel" onPress={onCancel} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1 }}>
            <Button
              testID="chat-confirm"
              size="sm"
              variant={destructive ? "danger" : "cta"}
              title={destructive ? "Yes, do it" : "Confirm"}
              loading={pending}
              onPress={onConfirm}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="chat-cancel" size="sm" variant="secondary" title="Cancel" onPress={onCancel} />
          </View>
        </View>
      )}
    </View>
  );
}
