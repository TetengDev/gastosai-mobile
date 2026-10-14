import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  AccessibilityInfo,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TextInputProps, TextProps, TextStyle, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Circle, Rect, Svg } from "react-native-svg";
import { isPaywallMessage } from "../api/client";
import { Piso } from "../brand/Piso";
import { formatCentavos } from "../lib/formatters";
import type { MeterTone } from "../lib/pisoMood";
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
  testID,
}: {
  children: ReactNode;
  tone?: "default" | "panel";
  style?: ViewStyle;
  testID?: string;
}) {
  const t = useTheme();
  const panel = tone === "panel";
  return (
    <View
      testID={testID}
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
          fontSize: t.fontSizes.micro,
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
          fontSize: t.fontSizes.display,
          letterSpacing: -0.5,
          color: t.colors.textHi,
          marginTop: 8,
        }}
      >
        {value}
      </Text>
      {sub ? (
        <Text
          style={{
            fontFamily: t.fonts.body,
            fontSize: t.fontSizes.caption,
            color: t.colors.text2,
            marginTop: 4,
          }}
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
          fontSize: t.fontSizes.heading,
          letterSpacing: -0.6,
          color: t.colors.textHi,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontFamily: t.fonts.body, fontSize: t.fontSizes.body, color: t.colors.text2 }}>
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
      <Text style={{ fontFamily: t.fonts.body, fontSize: t.fontSizes.caption, color: t.colors.text2 }}>
        {label}
      </Text>
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
            fontSize: t.fontSizes.content,
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
          style={{
            color: v.fg,
            fontFamily: t.fonts.bodyMedium,
            fontSize: size === "sm" ? t.fontSizes.caption : t.fontSizes.control,
          }}
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
          fontSize: t.fontSizes.caption,
          color: selected ? t.colors.ctaFg : t.colors.text,
        }}
      >
        {label}
      </Text>
    </Container>
  );
}

/**
 * A meter whose colour comes from the server's status, through `budgetTone` or `goalTone` —
 * never from the number. The bar clamps at 100; the reported value does not. Past 100 on a
 * budget, the overflow share is a lighter amber segment: React Native has no repeating gradient,
 * so web's hatching becomes a second tone here. Static on purpose; see `Piso`.
 */
export function ProgressMeter({
  percent,
  tone,
  label,
}: {
  percent: number;
  tone: MeterTone;
  label: string;
}) {
  const t = useTheme();
  const value = Number.isFinite(percent) ? percent : 0;
  const width = Math.max(0, Math.min(100, value));
  const shown = Math.round(value);
  const overflowShare = tone === "over" && value > 100 ? ((value - 100) / value) * 100 : 0;
  const fill = {
    onTrack: t.colors.brand,
    goal: t.colors.brand,
    warning: t.colors.warnText,
    over: t.colors.warnText,
    paused: t.colors.text3,
  }[tone];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.max(100, shown), now: shown, text: `${shown}%` }}
      style={{
        height: 8,
        borderRadius: 999,
        backgroundColor: t.colors.track,
        overflow: "hidden",
        flexDirection: "row",
      }}
    >
      <View testID="meter-fill" style={{ width: `${width - overflowShare}%`, backgroundColor: fill }} />
      {overflowShare > 0 ? (
        <View
          testID="meter-overflow"
          style={{ width: `${overflowShare}%`, backgroundColor: t.colors.warnBorder }}
        />
      ) : null}
    </View>
  );
}

/** The one way money is shown. Never reformats: it hands centavos to `formatCentavos`. */
export function Amount({
  centavos,
  currency = "PHP",
  size = "row",
  tone = "neutral",
}: {
  centavos: number;
  currency?: string;
  size?: "hero" | "row" | "inline";
  tone?: "neutral" | "positive" | "danger";
}) {
  const t = useTheme();
  // Same rule as `expenseAmountText`: a foreign figure drops the peso sign and names its currency.
  const text =
    currency === "PHP"
      ? formatCentavos(centavos)
      : `${formatCentavos(centavos).replace("₱", "")} ${currency}`;
  const font = {
    hero: { fontFamily: t.fonts.display, fontSize: t.fontSizes.display },
    row: { fontFamily: t.fonts.mono, fontSize: t.fontSizes.body },
    inline: { fontFamily: t.fonts.mono, fontSize: t.fontSizes.content },
  }[size];
  const color = { neutral: t.colors.text, positive: t.colors.greenHi, danger: t.colors.danger }[tone];
  return <Text style={{ ...font, color, fontVariant: ["tabular-nums"] }}>{text}</Text>;
}

/** Empty Piso, one line, one action — an empty screen has exactly one next step. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 40, paddingHorizontal: 16 }}>
      <Piso state="empty" size={96} />
      <Text
        accessibilityRole="header"
        style={{ fontFamily: t.fonts.display, fontSize: t.fontSizes.content, color: t.colors.text }}
      >
        {title}
      </Text>
      <Body dim style={{ textAlign: "center" }}>
        {body}
      </Body>
      <Button title={action.label} onPress={action.onPress} />
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
        {
          fontFamily: t.fonts.body,
          fontSize: t.fontSizes.body,
          color: dim ? t.colors.text2 : t.colors.text,
        },
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
 *
 * Drawn as a coin going into Piso's slot (TEN-443). The crossbar is Piso's own slot — 28:7, fully
 * rounded — in the disc's foreground; the upright is the coin's edge in gold, drawn *behind* the
 * slot so that it reads as going in. Together they are still a plain "+". The disc is rimmed in
 * the same gold at coin weight, so the whole button is the coin.
 *
 * One gold, `COIN_GOLD`, in both schemes: the disc flips from near-black to near-white, and this
 * holds 5.1:1 on the first and 3.05:1 on the second. Each `warn*` gold fails on one of them, and
 * the palette mirrors gastosai-web's CSS exactly, so a mobile-only token does not belong there.
 *
 * Pressing gives a light haptic and drops the coin 4pt into the slot (160 ms); the disc itself
 * sinks 2pt and flattens its shadow. Under reduced motion the coin does not move — the haptic and
 * the static sink stay. The disc stays `cta`, so the primary action is still the
 * highest-contrast thing on screen.
 */
const COIN_GOLD = "#ad8318";

export function FloatingAddButton({
  onPress,
  bottomOffset,
}: {
  onPress: () => void;
  bottomOffset: number;
}) {
  const t = useTheme();
  const drop = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduceMotion(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const settle = (toValue: 0 | 1) => {
    if (reduceMotion) return;
    Animated.timing(drop, { toValue, duration: 160, useNativeDriver: true }).start();
  };

  const artwork = {
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  } as const;
  const layer = { position: "absolute", top: 0, left: 0 } as const;
  const coinDrop = drop.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add expense"
      testID="fab-add"
      onPress={onPress}
      onPressIn={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        settle(1);
      }}
      onPressOut={() => settle(0)}
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
        transform: [{ translateY: pressed ? 2 : 0 }],
        // Lifts it off the content beneath, so it reads as floating rather than inline.
        shadowColor: "#000",
        shadowOpacity: pressed ? 0.15 : 0.25,
        shadowRadius: pressed ? 6 : 12,
        shadowOffset: { width: 0, height: pressed ? 2 : 4 },
        elevation: pressed ? 3 : 6,
      })}
    >
      <Svg width={56} height={56} viewBox="0 0 56 56" style={layer} {...artwork}>
        <Circle cx={28} cy={28} r={22} fill="none" stroke={COIN_GOLD} strokeWidth={4.5} />
      </Svg>
      <Animated.View style={[layer, { transform: [{ translateY: coinDrop }] }]} {...artwork}>
        <Svg width={56} height={56} viewBox="0 0 56 56" {...artwork}>
          <Rect x={24.5} y={16} width={7} height={25} rx={3.5} fill={COIN_GOLD} />
        </Svg>
      </Animated.View>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={layer} {...artwork}>
        <Rect x={14} y={25} width={28} height={7} rx={3.5} fill={t.colors.ctaFg} />
      </Svg>
    </Pressable>
  );
}

/**
 * A tappable row for hub screens: icon, label, optional trailing count, chevron.
 *
 * This is the standard iOS list-hub row, chosen because it is the pattern every phone user
 * already knows — the whole point of the More tab is that nothing about reaching a secondary
 * screen should need learning. Height is set by padding, not a fixed value, so it grows with the
 * user's text size instead of clipping — `minHeight: 44` on the pressable below is a floor under
 * that padding, not a replacement for it, so the 44pt touch target holds even if a future change
 * to the type scale shrinks the label.
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
        paddingVertical: 14,
        paddingHorizontal: 4,
        // Explicit, rather than relying on padding plus a text line's natural height: the type
        // scale that sizes the label and sub-line below is free to change without silently
        // shrinking this row under the 44pt touch target.
        minHeight: 44,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={21} color={destructive ? t.colors.danger : t.colors.text2} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: t.fonts.body, fontSize: t.fontSizes.content, color: fg }}>
          {label}
        </Text>
        {sub ? (
          <Text
            style={{
              fontFamily: t.fonts.body,
              fontSize: t.fontSizes.caption,
              color: t.colors.text2,
              marginTop: 2,
            }}
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
      <Text style={{ color: "#ffffff", fontFamily: t.fonts.bodyMedium, fontSize: t.fontSizes.micro }}>
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

/**
 * `‹  July 2026  ›` — the control that makes the rest of the data reachable.
 *
 * Before this existed every screen hard-coded the current month, so on a month with no spending
 * the app showed ₱0.00 and there was no way to look at any other month. Six months of data were
 * present and unreachable.
 *
 * Forward is disabled on the current month rather than hidden: a control that vanishes is more
 * confusing than one that greys out, and there is nothing to see in the future.
 */
export function MonthStepper({
  label,
  onPrev,
  onNext,
  canGoNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  const t = useTheme();
  const arrow = (dir: "back" | "forward", onPress: () => void, enabled: boolean) => (
    <Pressable
      testID={dir === "back" ? "month-prev" : "month-next"}
      accessibilityRole="button"
      accessibilityLabel={dir === "back" ? "Previous month" : "Next month"}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        opacity: !enabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <Ionicons
        name={dir === "back" ? "chevron-back" : "chevron-forward"}
        size={20}
        color={t.colors.textHi}
      />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      {arrow("back", onPrev, true)}
      <Text
        testID="month-label"
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: t.fonts.display,
          fontSize: t.fontSizes.content,
          color: t.colors.textHi,
        }}
      >
        {label}
      </Text>
      {arrow("forward", onNext, canGoNext)}
    </View>
  );
}

/** Search input with a clear button, for narrowing a list that is already on screen. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: t.colors.inputBg,
        borderColor: t.colors.borderInput,
        borderWidth: 1,
        borderRadius: t.radii.input,
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name="search" size={16} color={t.colors.text3} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.colors.text3}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1,
          color: t.colors.textHi,
          fontFamily: t.fonts.body,
          fontSize: t.fontSizes.body,
          paddingVertical: 10,
        }}
      />
      {value ? (
        <Pressable
          testID="search-clear"
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          hitSlop={10}
        >
          <Ionicons name="close-circle" size={17} color={t.colors.text3} />
        </Pressable>
      ) : null}
    </View>
  );
}

export interface RowAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * The `⋯` that holds a row's secondary actions.
 *
 * Every list row used to carry two or three inline text links — *Edit limit / Remove*,
 * *Pause / Delete*, *Rename / Delete*. On Budgets that put about ten small targets down the screen
 * with nothing ranking them, which is hard to scan and easy to mis-tap. The frequent action stays
 * visible on the row; everything else moves in here.
 *
 * `ActionSheetIOS` is the native presentation and costs no dependency. Android falls back to an
 * `Alert`, which is not as elegant but is the same list of choices — and this app is iOS-first
 * today. `destructiveButtonIndex` gets iOS to colour the dangerous item for us rather than us
 * approximating it.
 */
export function RowMenu({
  actions,
  title,
  testID,
  disabled,
}: {
  actions: RowAction[];
  /** Names the thing being acted on, so the sheet is unambiguous with several rows on screen. */
  title?: string;
  testID?: string;
  /** Set while this row has a request in flight, so a delete cannot be fired twice. */
  disabled?: boolean;
}) {
  const t = useTheme();

  const open = () => {
    const labels = actions.map((a) => a.label);
    const destructiveButtonIndex = actions.findIndex((a) => a.destructive);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...labels, "Cancel"],
          cancelButtonIndex: labels.length,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
          userInterfaceStyle: t.scheme,
        },
        (index) => {
          if (index < labels.length) actions[index].onPress();
        },
      );
      return;
    }

    Alert.alert(title ?? "Actions", undefined, [
      ...actions.map((a) => ({
        text: a.label,
        style: a.destructive ? ("destructive" as const) : ("default" as const),
        onPress: a.onPress,
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title ? `Actions for ${title}` : "Actions"}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={open}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.3 : pressed ? 0.5 : 1,
      })}
    >
      <Ionicons name="ellipsis-horizontal" size={19} color={t.colors.text2} />
    </Pressable>
  );
}

/**
 * A bar per day, drawn with plain views.
 *
 * Deliberately not a charting library: `react-native-svg` is a native dependency (CLAUDE.md §8 puts
 * those behind an ask) and this is a strip of rectangles. Heights are a proportion of the largest
 * value, which is presentation of numbers the server already computed — no total is derived here.
 *
 * A zero-value day still gets a hairline so the month reads as continuous rather than gappy.
 */
export function MiniBars({
  values,
  height = 56,
  highlightLast,
}: {
  values: number[];
  height?: number;
  /** Marks today in the current month, where the last bar is a partial day. */
  highlightLast?: boolean;
}) {
  const t = useTheme();
  const max = Math.max(...values, 0);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height }}>
      {values.map((v, i) => {
        const ratio = max > 0 ? v / max : 0;
        const isLast = highlightLast && i === values.length - 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(2, ratio * height),
              borderRadius: 2,
              backgroundColor: isLast ? t.colors.brand : v > 0 ? t.colors.text3 : t.colors.track,
            }}
          />
        );
      })}
    </View>
  );
}

/** Card-shaped loading placeholder, matching web's `h-40 rounded-2xl bg-surface-2` skeletons. */
export function Skeleton({ height = 96 }: { height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: t.radii.card, backgroundColor: t.colors.surface2 }} />
  );
}

/**
 * A plan boundary, rendered as the offer it is rather than as a failure.
 *
 * Deliberately not red and not `ErrorText`'s voice: nothing broke and the user did nothing wrong,
 * so the danger colour would be the app blaming them for not having paid. The card carries the
 * server's reason and the one thing that resolves it.
 *
 * "View plans" goes to the More hub, where the plan card sits with its own View plans control. The
 * plans sheet is local state inside that screen rather than a route of its own, so this is as
 * direct as a link can currently be — one tap short of the sheet, and still a real affordance
 * instead of a sentence telling someone to go hunting.
 *
 * `navigate`, not `push`: More is a tab, and pushing stacks a second copy of a destination the
 * user can already reach from the bar.
 */
function PaywallNotice({ message }: { message: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Card testID="paywall-notice" tone="panel">
      <Text style={{ fontFamily: t.fonts.body, fontSize: t.fontSizes.control, color: t.colors.textHi }}>
        {message}
      </Text>
      <Button
        testID="paywall-view-plans"
        title="View plans"
        size="sm"
        onPress={() => router.navigate("/(app)/more" as never)}
      />
    </Card>
  );
}

/**
 * Every error string in this app is rendered through here, which is why the paywall branch lives
 * here too.
 *
 * A 402 is not an error — it is "this costs money, here is how to buy it" — and it can come back
 * from any request, so handling it screen by screen guarantees the one screen nobody remembered.
 * `errorMessage` in `src/api/client.ts` already turns a plan gate into copy ending in
 * `UPGRADE_PROMPT`; matching that exact suffix is how the string gets recognised without the error
 * object, which screens do not pass down. The suffix is a constant that module owns, so this is
 * identity against a known value, not prose sniffing — and a message rendered without this
 * component still reads correctly on its own, because the sentence *is* the instruction.
 */
export function ErrorText({ children }: { children?: string | null }) {
  const t = useTheme();
  if (!children) return null;
  if (isPaywallMessage(children)) return <PaywallNotice message={children} />;
  return (
    <Text style={{ fontFamily: t.fonts.body, fontSize: t.fontSizes.control, color: t.colors.danger }}>
      {children}
    </Text>
  );
}
