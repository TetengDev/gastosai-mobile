import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
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
  testID,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  /**
   * For UI automation. Worth setting wherever the button's title also appears as a screen title:
   * a text match hits the header first and taps nothing, which reads in a test log as a button
   * that silently does not work.
   */
  testID?: string;
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
      testID={testID}
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

/**
 * Rounded-full chip with an optional leading dot, as web uses for statuses.
 *
 * With `onPress` it becomes a selectable category chip — tapping a category is far faster than
 * typing one, which is the difference between logging an expense in seconds and abandoning it.
 */
export function Pill({
  label,
  dotColor,
  selected,
  onPress,
  testID,
}: {
  label: string;
  dotColor?: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const Container = onPress ? Pressable : View;
  return (
    <Container
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: selected ? t.colors.cta : t.colors.surface4,
        borderColor: selected ? t.colors.cta : t.colors.border2,
        borderWidth: 1,
        borderRadius: t.radii.pill,
        paddingHorizontal: 14,
        // Taller when tappable, to stay near the 44pt target.
        paddingVertical: onPress ? 9 : 4,
      }}
    >
      {dotColor ? (
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dotColor }} />
      ) : null}
      <Text
        style={{
          fontFamily: t.fonts.body,
          fontSize: 13,
          color: selected ? t.colors.ctaFg : t.colors.text,
        }}
      >
        {label}
      </Text>
    </Container>
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

/**
 * The primary capture action, floating above the tab bar in the bottom-right — the easiest place
 * to reach one-handed, which matters because logging an expense should take seconds and often
 * happens while walking or paying.
 *
 * Kept out of the tab bar on purpose: that bar is for destinations, and mixing an action into it
 * is the most consistently warned-against tab-bar mistake.
 */
export function FloatingAddButton({
  onPress,
  bottomOffset,
}: {
  onPress: () => void;
  bottomOffset: number;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add expense"
      testID="fab-add"
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        right: 20,
        bottom: bottomOffset,
        width: 56, // comfortably above the 44pt minimum target
        height: 56,
        borderRadius: 999,
        backgroundColor: t.colors.cta,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
        // Lifts it off the content beneath, so it reads as floating rather than inline.
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      })}
    >
      <Text style={{ color: t.colors.ctaFg, fontSize: 30, lineHeight: 34, fontFamily: t.fonts.display }}>
        +
      </Text>
    </Pressable>
  );
}

/**
 * A tappable row for hub screens: icon, label, optional trailing count, chevron.
 *
 * This is the standard iOS list-hub row, chosen because it is the pattern every phone user
 * already knows — the whole point of the More tab is that nothing about reaching a secondary
 * screen should need learning. Height is set by padding rather than a fixed value so it grows
 * with the user's text size instead of clipping.
 */
export function ListRow({
  icon,
  label,
  sub,
  badge,
  destructive,
  onPress,
  testID,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub?: string;
  badge?: number;
  /** Sign out, and anything else that is not simply navigation. */
  destructive?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const fg = destructive ? t.colors.danger : t.colors.textHi;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        // 14 + 14 + a ~20pt line comfortably exceeds the 44pt minimum target.
        paddingVertical: 14,
        paddingHorizontal: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={21} color={destructive ? t.colors.danger : t.colors.text2} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: t.fonts.body, fontSize: 16, color: fg }}>{label}</Text>
        {sub ? (
          <Text
            style={{ fontFamily: t.fonts.body, fontSize: 12.5, color: t.colors.text2, marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {badge ? <Badge count={badge} /> : null}
      {destructive ? null : (
        <Ionicons name="chevron-forward" size={17} color={t.colors.text3} />
      )}
    </Pressable>
  );
}

/** Unread count. Renders nothing at zero rather than an empty circle. */
export function Badge({ count }: { count: number }) {
  const t = useTheme();
  if (count <= 0) return null;
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 999,
        paddingHorizontal: 6,
        backgroundColor: t.colors.danger,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#ffffff", fontFamily: t.fonts.bodyMedium, fontSize: 11 }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

/** Hairline divider between list rows, matching web's `divide-y`. */
export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.colors.border3 }} />;
}

/** Card-shaped loading placeholder, matching web's `h-40 rounded-2xl bg-surface-2` skeletons. */
export function Skeleton({ height = 96 }: { height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: t.radii.card, backgroundColor: t.colors.surface2 }} />
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
