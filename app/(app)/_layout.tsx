import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { FloatingAddButton } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

/**
 * Four persistent destinations, mirroring a subset of gastosai-web's nav (Dashboard, Expenses,
 * Budget, Goals) so the mental model carries between the two products.
 *
 * This replaces a scrolling stack of buttons on the dashboard. That layout put every destination
 * below the fold — the Maestro flows needed `scrollUntilVisible` before every single navigation
 * tap, which was the app saying out loud that its navigation was unreachable.
 *
 * Add is deliberately NOT a tab. It is an action, not a destination, and mixing the two is the
 * thing tab-bar guidance warns against most consistently. It lives in a floating button instead,
 * within thumb reach.
 */
export default function AppLayout() {
  const { user, ready } = useAuth();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  // Guard the whole authenticated group in one place rather than per screen.
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;

  // Quick-add is the fastest capture path and the reason this app is worth having on a phone;
  // manual entry stays reachable from inside it.
  const isTabScreen = ["/", "/expenses", "/budgets", "/goals"].includes(pathname);

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.page },
          headerTintColor: t.colors.textHi,
          headerTitleStyle: { fontFamily: t.fonts.display, fontSize: 17 },
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: t.colors.page },
          tabBarActiveTintColor: t.colors.textHi,
          tabBarInactiveTintColor: t.colors.text3,
          tabBarLabelStyle: { fontFamily: t.fonts.bodyMedium, fontSize: 11 },
          tabBarStyle: {
            backgroundColor: t.colors.surface,
            borderTopColor: t.colors.border,
            borderTopWidth: 1,
            // Clears the home indicator without the labels crowding it.
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            // Explicit test id: React Navigation tab labels are not reliably exposed as text
            // nodes to UI automation, and "Home" collides with Expo Go's own launcher tab.
            tabBarButtonTestID: "tab-home",
            title: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
            headerRight: () => (
              <Ionicons
                testID="header-settings"
                accessibilityLabel="Settings"
                name="settings-outline"
                size={22}
                color={t.colors.text2}
                style={{ marginRight: 16 }}
                onPress={() => router.push("/(app)/settings")}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="expenses"
          options={{
            // Explicit test id: React Navigation tab labels are not reliably exposed as text
            // nodes to UI automation, and "Home" collides with Expo Go's own launcher tab.
            tabBarButtonTestID: "tab-expenses",
            title: "Expenses",
            tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="budgets"
          options={{
            // Explicit test id: React Navigation tab labels are not reliably exposed as text
            // nodes to UI automation, and "Home" collides with Expo Go's own launcher tab.
            tabBarButtonTestID: "tab-budgets",
            title: "Budgets",
            tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="goals"
          options={{
            // Explicit test id: React Navigation tab labels are not reliably exposed as text
            // nodes to UI automation, and "Home" collides with Expo Go's own launcher tab.
            tabBarButtonTestID: "tab-goals",
            title: "Goals",
            tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" color={color} size={size} />,
          }}
        />

        {/* Pushed over the tabs rather than being destinations of their own. */}
        <Tabs.Screen name="quick-add" options={{ href: null, title: "Quick add" }} />
        <Tabs.Screen name="add-expense" options={{ href: null, title: "Add expense" }} />
        <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
        <Tabs.Screen name="expense/[id]" options={{ href: null, title: "Edit expense" }} />
      </Tabs>

      {/* Only on the four tab destinations. On a pushed screen — add, quick-add, edit — a
          button offering to add an expense is meaningless and overlaps the form's own actions. */}
      {isTabScreen ? (
        <FloatingAddButton
          bottomOffset={56 + insets.bottom + 16}
          onPress={() => router.push("/(app)/quick-add")}
        />
      ) : null}
    </>
  );
}
