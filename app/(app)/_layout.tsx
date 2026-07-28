import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listAlerts, unreadCount } from "../../src/api/alerts";
import { useAuth } from "../../src/context/AuthContext";
import { FloatingAddButton } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

/**
 * Five persistent destinations. Four mirror a subset of gastosai-web's nav (Dashboard, Expenses,
 * Budget, Goals) so the mental model carries between the two products; the fifth is a hub for
 * everything that is not a daily destination.
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

  // Same query key as the More screen, so the badge and the list share one fetch rather than
  // racing each other. `enabled` keeps it from firing on the login screen.
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts, enabled: !!user });
  const unread = unreadCount(alerts.data);

  // Guard the whole authenticated group in one place rather than per screen.
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;

  // Quick-add is the fastest capture path and the reason this app is worth having on a phone;
  // manual entry stays reachable from inside it.
  // More is excluded on purpose: it is a hub of settings-shaped rows, not a spending context,
  // and a floating + would sit on top of its list.
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
            // Settings used to hang off this header. It moved into More, so Home's chrome now
            // carries nothing that isn't about spending.
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

        <Tabs.Screen
          name="more/index"
          options={{
            tabBarButtonTestID: "tab-more",
            title: "More",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="ellipsis-horizontal" color={color} size={size} />
            ),
            // Surfaces an unread alert without the user having to open the hub to find it.
            tabBarBadge: unread > 0 ? unread : undefined,
            tabBarBadgeStyle: { backgroundColor: t.colors.danger, fontSize: 11 },
          }}
        />

        {/* Pushed over the tabs rather than being destinations of their own. */}
        <Tabs.Screen name="quick-add" options={{ href: null, title: "Quick add" }} />
        <Tabs.Screen name="add-expense" options={{ href: null, title: "Add expense" }} />
        <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
        <Tabs.Screen name="expense/[id]" options={{ href: null, title: "Edit expense" }} />
        <Tabs.Screen name="more/recurring" options={{ href: null, title: "Recurring" }} />
        <Tabs.Screen name="more/categories" options={{ href: null, title: "Categories" }} />
        <Tabs.Screen name="more/alerts" options={{ href: null, title: "Alerts" }} />
        <Tabs.Screen name="more/chat" options={{ href: null, title: "Ask AI" }} />
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
