import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

/** Minimal shared primitives. Deliberately small — this is a v1 capture loop, not a design system. */

export const colors = {
  bg: "#0F1115",
  card: "#171A21",
  border: "#252A34",
  text: "#F5F7FA",
  muted: "#9AA4B2",
  accent: "#3DDC97",
  danger: "#FF6B6B",
};

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
}) {
  const ghost = variant === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        ghost && styles.buttonGhost,
        (pressed || loading) && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ghost ? colors.text : colors.bg} />
      ) : (
        <Text style={[styles.buttonText, ghost && styles.buttonTextGhost]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.bg, fontWeight: "700", fontSize: 16 },
  buttonTextGhost: { color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
});
