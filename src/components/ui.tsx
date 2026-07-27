import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { TextInputProps, TextProps, TextStyle, ViewStyle } from "react-native";
import { useTheme } from "../theme/useTheme";

/**
 * Primitives mirroring `gastosai-web/src/components/ui/`.
 *
 * Shapes and roles are matched deliberately: pill buttons, `rounded-2xl` cards, and the mono
 * uppercase micro-label above a display-font value. Those choices are what make the two products
 * read as one — they are not incidental styling.
 *
 * Colours always come from `useTheme()`, never hardcoded, so both appearances work. The previous
 * version of this file exported a fixed dark palette built around a mint green that appears
 * nowhere in the web app.
 */

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: t.colors.page, padding: t.spacing.screen, gap: t.spacing.gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** `rounded-2xl` + surface + border. `tone="panel"` uses the warm surface, as web's budget block does. */
export function Card({
  children,
  tone = "default",
  style,
}: {
  children: ReactNode;
  tone?: "default" | "panel";
  style?: ViewStyle;
}) {
  const t = useTheme();
  const panel = tone === "panel";
  return (
    <View
      style={[
        {
          backgroundColor: panel ? t.colors.surface3 : t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: panel ? 0 : 1,
          borderRadius: t.radii.card,
          padding: t.spacing.card,
          gap: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Web's dashboard signature: a Space Mono uppercase micro-label, a Space Grotesk value, and an
 * optional sub-line. Reproducing this is most of what makes the dashboard recognisable.
 */
export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const t = useTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: t.fonts.mono,
          fontSize: 11,
          letterSpacing: 1.3, // web: tracking-[0.12em] at 11px
          textTransform: "uppercase",
          color: t.colors.text3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: t.fonts.display,
          fontSize: 32,
          letterSpacing: -0.5,
          color: t.colors.textHi,
          marginTop: 8,
        }}
      >
        {value}
      </Text>
      {sub ? (
        <Text
          style={{ fontFamily: t.fonts.body, fontSize: 12.5, color: t.colors.text2, marginTop: 4 }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontFamily: t.fonts.display,
          fontSize: 30,
          letterSpacing: -0.6,
          color: t.colors.textHi,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontFamily: t.fonts.body, fontSize: 15, color: t.colors.text2 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Field({ label, style, ...props }: { label: string } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text2 }}>{label}</Text>
      <TextInput
        placeholderTextColor={t.colors.text3}
        autoCapitalize="none"
        style={[
          {
            backgroundColor: t.colors.inputBg,
            borderColor: t.colors.borderInput,
            borderWidth: 1,
            borderRadius: t.radii.input,
            color: t.colors.textHi,
            fontFamily: t.fonts.body,
            fontSize: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export type ButtonVariant = "cta" | "secondary" | "ghost" | "danger";

/** Pill-shaped, matching web. `cta` is near-black on light and near-white on dark — not green. */
export function Button({
  title,
  onPress,
  loading,
  variant = "cta",
  size = "md",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  const t = useTheme();
  const pad =
    size === "sm"
      ? { paddingHorizontal: 16, paddingVertical: 8 }
      : { paddingHorizontal: 24, paddingVertical: 13 };

  const variants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    cta: { bg: t.colors.cta, fg: t.colors.ctaFg, border: "transparent" },
    secondary: { bg: t.colors.surface, fg: t.colors.textHi, border: t.colors.borderInput },
    ghost: { bg: "transparent", fg: t.colors.text2, border: "transparent" },
    danger: { bg: t.colors.danger, fg: "#ffffff", border: "transparent" },
  };
  const v = variants[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.border === "transparent" ? 0 : 1,
          borderRadius: t.radii.pill,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed || loading ? 0.7 : 1,
        },
        pad,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text
          style={{ color: v.fg, fontFamily: t.fonts.bodyMedium, fontSize: size === "sm" ? 13 : 14 }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Rounded-full chip with an optional leading dot, as web uses for statuses. */
export function Pill({ label, dotColor }: { label: string; dotColor?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: t.colors.surface4,
        borderColor: t.colors.border2,
        borderWidth: 1,
        borderRadius: t.radii.pill,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      {dotColor ? (
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dotColor }} />
      ) : null}
      <Text style={{ fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text }}>{label}</Text>
    </View>
  );
}

/**
 * Renders a percentage the backend already computed. Clamped only for drawing — callers still
 * show the true figure, so an over-budget 130% reads as 130% rather than being hidden.
 */
export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const t = useTheme();
  const width = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <View
      style={{ height: 8, borderRadius: 999, backgroundColor: t.colors.track, overflow: "hidden" }}
    >
      <View
        style={{
          height: 8,
          borderRadius: 999,
          width: `${width}%`,
          backgroundColor: color ?? t.colors.brand,
        }}
      />
    </View>
  );
}

/** Body text. Forwards the rest of TextProps so callers can use numberOfLines and friends. */
export function Body({
  children,
  dim,
  style,
  ...rest
}: { children: ReactNode; dim?: boolean; style?: TextStyle } & Omit<TextProps, "style" | "children">) {
  const t = useTheme();
  return (
    <Text
      style={[
        { fontFamily: t.fonts.body, fontSize: 15, color: dim ? t.colors.text2 : t.colors.text },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const t = useTheme();
  if (!children) return null;
  return (
    <Text style={{ fontFamily: t.fonts.body, fontSize: 14, color: t.colors.danger }}>
      {children}
    </Text>
  );
}
