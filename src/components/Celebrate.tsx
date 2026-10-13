import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Piso } from "../brand/Piso";
import { hasCelebrated, markCelebrated } from "../lib/celebrateStore";
import { useTheme } from "../theme/useTheme";

/**
 * Mount it only when the trigger holds. It marks the event seen before playing, so a remount
 * cannot play it twice. The coin is the only motion in the Piso family; Piso itself stays static.
 */
export function Celebrate({ event, size = 96 }: { event: string; size?: number }) {
  const t = useTheme();
  const [playing, setPlaying] = useState(false);
  const [withCoin, setWithCoin] = useState(false);
  const drop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    (async () => {
      if (await hasCelebrated(event)) return;
      await markCelebrated(event);
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
      if (!live) return;
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
  }, [event, drop]);

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
