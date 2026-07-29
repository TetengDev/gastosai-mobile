import { Text, View } from "react-native";
import { Body, Button } from "../ui";
import { actionLabel, isDestructive } from "./chatActions";
import { useTheme } from "../../theme/useTheme";

export interface ActionPreview {
  toolName: string;
  params: Record<string, unknown>;
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

  // Scalars only. A nested object would render as "[object Object]", which tells the user nothing
  // about what they are approving — and approving something you cannot read is the failure mode
  // this card exists to prevent.
  const fields = Object.entries(preview.params).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== "object",
  );

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

      {fields.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Body dim style={{ fontSize: 13 }}>
            {k}
          </Body>
          <Text style={{ fontFamily: t.fonts.display, fontSize: 14, color: t.colors.textHi }}>
            {String(v)}
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
