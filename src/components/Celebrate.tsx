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

/**
 * Mount it only when the trigger holds. The event is spent only at the moment it plays, so an
 * unmount mid-check leaves it for the next mount. The coin is the only motion in the Piso family;
 * Piso itself stays static.
 */
export function Celebrate({ event, size = 96 }: { event: string; size?: number }) {
  const t = useTheme();
  const [playing, setPlaying] = useState(false);
  const [withCoin, setWithCoin] = useState(false);
  const drop = useRef(new Animated.Value(0)).current;

  const account = useAuth().user?.email;

  useEffect(() => {
    // The seen flag is per account; with no account there is nothing to scope it to.
    if (!account) return;
    let live = true;
    (async () => {
      if (await hasCelebrated(account, event)) return;
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
      const claim = celebrationKey(account, event);
      if (!live || claimed.has(claim)) return;
      claimed.add(claim);
      void markCelebrated(account, event);
      setPlaying(true);
      setWithCoin(!reduce);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (!reduce) {
        Animated.timing(drop, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    })();
    return () => {
      live = false;
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
