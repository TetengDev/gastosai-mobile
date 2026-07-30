import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listAlerts, unreadCount } from "../../src/api/alerts";
import { useAuth } from "../../src/context/AuthContext";
import { MonthProvider } from "../../src/context/MonthContext";
import { NavOriginProvider } from "../../src/context/NavOriginContext";
import { FloatingAddButton } from "../../src/components/ui";
import { useTheme } from "../../src/theme/useTheme";

/**
 * Every screen reachable only by pushing — the ones that need a back button.
 *
 * Kept as data rather than eight near-identical JSX blocks so that adding a screen cannot silently
 * ship without a way out, which is exactly how the previous eight ended up without one.
 */
const pushedScreens = [
  // `parent` is where back goes, declared rather than inferred.
  //
  // `router.back()` alone is wrong here: these screens are siblings of the tabs, not entries on a
  // stack, so popping returns to the *initial tab* — leaving More, opening Recurring and pressing
  // back landed on Home. A back button that goes somewhere you were not is worse than none, and it
  // is the "I lose my place" complaint in miniature.
  { name: "quick-add", title: "Quick add", parent: "/(app)" },
  { name: "add-expense", title: "Add expense", parent: "/(app)" },
  { name: "settings", title: "Settings", parent: "/(app)/more" },
  { name: "expense/[id]", title: "Edit expense", parent: "/(app)" },
  { name: "more/recurring", title: "Recurring", parent: "/(app)/more" },
  { name: "more/categories", title: "Categories", parent: "/(app)/more" },
  { name: "more/alerts", title: "Alerts", parent: "/(app)/more" },
  { name: "more/chat", title: "Ask AI", parent: "/(app)/more" },
] as const;

/**
 * The back control these screens would have had if they were stack routes.
 *
 * `parent` is where back goes. For most screens it is the fixed value declared in `pushedScreens`;
 * for chat, which is openable from all five tabs, the layout passes the tab you came from.
 *
 * An earlier attempt carried the origin as a `from` route param. It does not survive: these
 * screens are tab siblings, and a push between siblings does not attach params the way a stack
 * push does — back silently fell through to the declared parent and always landed on More.
 */
function HeaderBack({ parent }: { parent: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Ionicons
      testID="header-back"
      accessibilityRole="button"
      accessibilityLabel="Back"
      name="chevron-back"
      size={26}
      color={t.colors.textHi}
      style={{ marginLeft: 8, paddingRight: 8 }}
      // `navigate`, not `push`: returning to a parent should not stack another copy of it.
      onPress={() => router.navigate(parent as never)}
    />
  );
}

/**
 * Ask-AI, reachable from every tab.
 *
 * Web mounts its chat widget at the app root so it floats on every page; on mobile it was three
 * taps down inside More. The bottom-right corner is already the capture button and must stay that
 * way, so this takes the header instead — one tap from anywhere, which is what the floating widget
 * actually buys.
 */
function HeaderChat() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Ionicons
      testID="header-chat"
      accessibilityRole="button"
      accessibilityLabel="Ask AI"
      name="sparkles-outline"
      size={21}
      color={t.colors.text2}
      style={{ marginRight: 16, paddingLeft: 8 }}
      onPress={() => router.push("/(app)/more/chat")}
    />
  );
}

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

  // The tab chat should return to. A ref rather than state: it must not itself trigger a render,
  // and it is only ever read at the moment the back button is pressed.
  const lastTab = useRef("/(app)");

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

  // Where chat should return to. Chat is reachable from every tab, so a fixed parent would send
  // you to More no matter where you opened it — the "lose my place" complaint one level down.
  const tabPaths: Record<string, string> = {
    "/": "/(app)",
    "/expenses": "/(app)/expenses",
    "/budgets": "/(app)/budgets",
    "/goals": "/(app)/goals",
    "/more": "/(app)/more",
  };
  if (tabPaths[pathname]) lastTab.current = tabPaths[pathname];

  return (
    <NavOriginProvider value={lastTab.current}>
      <MonthProvider>
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
            headerRight: () => <HeaderChat />,
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
            headerRight: () => <HeaderChat />,
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
            headerRight: () => <HeaderChat />,
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
            headerRight: () => <HeaderChat />,
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
            headerRight: () => <HeaderChat />,
            // Surfaces an unread alert without the user having to open the hub to find it.
            tabBarBadge: unread > 0 ? unread : undefined,
            tabBarBadgeStyle: { backgroundColor: t.colors.danger, fontSize: 11 },
          }}
        />

        {/*
          Pushed over the tabs rather than being destinations of their own.

          Each one needs an explicit `headerLeft`. These are registered as tabs with a hidden
          button (`href: null`), not as stack routes, so React Navigation has no previous screen to
          derive a back control from and renders none — which left every one of these screens with
          **no way out except tapping another tab**. `headerBackTitle` does not help for the same
          reason: there is no stack entry to title.
        */}
        {pushedScreens.map(({ name, title, parent }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              href: null,
              title,
              headerLeft: () => (
                <HeaderBack parent={name === "more/chat" ? lastTab.current : parent} />
              ),
            }}
          />
        ))}
      </Tabs>

      {/* Only on the four tab destinations. On a pushed screen — add, quick-add, edit — a
          button offering to add an expense is meaningless and overlaps the form's own actions. */}
      {isTabScreen ? (
        <FloatingAddButton
          bottomOffset={56 + insets.bottom + 16}
          onPress={() => router.push("/(app)/quick-add")}
        />
      ) : null}
      </MonthProvider>
    </NavOriginProvider>
  );
}
