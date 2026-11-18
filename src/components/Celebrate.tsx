import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Piso } from "../brand/Piso";
import { useAuth } from "../context/AuthContext";
import { celebrationKey, hasCelebrated, markCelebrated } from "../lib/celebrateStore";
import { useTheme } from "../theme/useTheme";

// Events claimed this session. The stored flag is async, so two mounts can both read "unseen";
// this synchronous claim is what lets only one of them play.
const claimed = new Set<string>();

/** The coin's drop. */
const COIN_MS = 600;
/** How long one celebration holds the stage before `onDone`, coin or not: web's CELEBRATION_HOLD_MS. */
const HOLD_MS = 1500;

/**
 * Mount it only when the trigger holds. The event is spent only at the moment it plays, so an
 * unmount mid-check leaves it for the next mount. The coin is the only motion in the Piso family;
 * Piso itself stays static.
 */
export function Celebrate({
  event,
  size = 96,
  onDone,
}: {
  event: string;
  size?: number;
  /**
   * Called once it has played and held, or at once when it will not (seen already, or claimed
   * elsewhere). Never called by a signed-out mount, which plays nothing, nor by one unmounted mid-play.
   */
  onDone?: () => void;
}) {
  const t = useTheme();
  const [playing, setPlaying] = useState(false);
  const [withCoin, setWithCoin] = useState(false);
  const drop = useRef(new Animated.Value(0)).current;

  // A ref, so a caller's inline callback does not re-run the effect below.
  const done = useRef(onDone);
  done.current = onDone;

  const account = useAuth().user?.email;

  useEffect(() => {
    // The seen flag is per account; with no account there is nothing to scope it to.
    if (!account) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      if (await hasCelebrated(account, event)) {
        if (live) done.current?.();
        return;
      }
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
      const claim = celebrationKey(account, event);
      if (!live) return;
      if (claimed.has(claim)) {
        done.current?.();
        return;
      }
      claimed.add(claim);
      void markCelebrated(account, event);
      setPlaying(true);
      setWithCoin(!reduce);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (!reduce) {
        Animated.timing(drop, { toValue: 1, duration: COIN_MS, useNativeDriver: true }).start();
      }
      timer = setTimeout(() => done.current?.(), HOLD_MS);
    })();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [account, event, drop]);

  if (!playing) return null;

  return (
    <View style={{ width: size, height: size }}>
      <Piso state="cheer" size={size} />
      {withCoin ? (
        <Animated.View
          testID="coin"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            top: 0,
            left: size / 2 - 8,
            width: 16,
            height: 16,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: t.colors.warnText,
            backgroundColor: t.colors.warnBorder,
            opacity: drop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
            ],
          }}
        />
      ) : null}
    </View>
  );
}
