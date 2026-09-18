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
}

/**
 * How deep a path is expanded before the remainder is shown as JSON.
 *
 * `params` is server-sent JSON, so it cannot be cyclic, but a pathological depth would otherwise
 * produce one row per leaf of an arbitrarily large tree. Four levels covers anything a tool call
 * plausibly carries; past that the JSON text is still readable, which is all the card promises.
 */
const MAX_DEPTH = 4;

function isScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object";
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "—";
  } catch {
    return "(unreadable)";
  }
}

function flatten(value: unknown, key: string, depth: number, out: PreviewField[]): void {
  // `String(value)` is only ever reached for a non-object, so "[object Object]" cannot be produced.
  if (isScalar(value)) {
    out.push({ key, value: scalarText(value) });
    return;
  }
  if (depth >= MAX_DEPTH) {
    out.push({ key, value: jsonText(value) });
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ key, value: "(none)" });
      return;
    }
    // A list of ids or dates reads better as one row than as one row per index.
    if (value.every(isScalar)) {
      out.push({ key, value: value.map(scalarText).join(", ") });
      return;
    }
    value.forEach((item, i) => flatten(item, `${key}[${i}]`, depth + 1, out));
    return;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    out.push({ key, value: "(none)" });
    return;
  }
  for (const [k, v] of entries) flatten(v, `${key}.${k}`, depth + 1, out);
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
 */
export function previewFields(params: Record<string, unknown>): PreviewField[] {
  const out: PreviewField[] = [];
  for (const [k, v] of Object.entries(params)) flatten(v, k, 0, out);
  return out;
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

      {fields.map(({ key, value }) => (
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
              color: t.colors.textHi,
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
