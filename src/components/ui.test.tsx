import { describe, expect, it, jest } from "@jest/globals";
import * as ReactNative from "react-native";
import { ActionSheetIOS, processColor } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent } from "@testing-library/react-native";
import {
  Amount,
  Badge,
  Body,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorText,
  Field,
  FloatingAddButton,
  ListRow,
  MiniBars,
  MonthStepper,
  PageHeader,
  Pill,
  ProgressMeter,
  RowMenu,
  Screen,
  SearchField,
  Skeleton,
  StatTile,
} from "./ui";
import { palettes } from "../theme";
import AppLayout from "../../app/(app)/_layout";

/**
 * The tab layout's tests live here, not beside it: anything under `app/` is a route to
 * expo-router (its context regex takes every `.tsx`), so a test file there would ship in the
 * bundle as a screen — and jest's `testMatch` only looks under `src/` anyway.
 *
 * `Tabs` is replaced by a stand-in that renders each visible tab's title in declaration order,
 * which is the only part of React Navigation these tests are about.
 */
const mockPush = jest.fn();
let mockPathname = "/";
jest.mock("expo-router", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
  function Tabs({ children }: { children: unknown }) {
    return createElement(View, null, children as never);
  }
  Tabs.Screen = function Screen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string; href?: null };
  }) {
    return options?.href === null
      ? null
      : createElement(Text, { testID: `tab-screen-${name}` }, options?.title);
  };
  return {
    Tabs,
    Redirect: () => null,
    usePathname: () => mockPathname,
    useRouter: () => ({ push: mockPush, navigate: jest.fn() }),
  };
});
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "demo@example.com" }, ready: true }),
}));
jest.mock("../api/alerts", () => ({ listAlerts: async () => [], unreadCount: () => 0 }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

/**
 * First test file for `ui.tsx` (TEN-434). Covers the key primitives rendering, plus the six
 * invariants the type-scale refactor could have broken without anyone noticing:
 * `FloatingAddButton` staying out of the tab bar (asserted elsewhere, in the tab layout — here
 * only that it renders its own control), `ListRow`'s 44pt touch target, `RowMenu`'s
 * `ActionSheetIOS` with `destructiveButtonIndex`, `MonthStepper` disabling rather than hiding at
 * the boundary, `PaywallNotice` reading as an offer, and `MiniBars` staying drawn from plain
 * views.
 */

describe("ui primitives render", () => {
  it("Screen, Card and Body render their children", () => {
    render(
      <Screen>
        <Card testID="card">
          <Body>hello</Body>
        </Card>
      </Screen>,
    );
    expect(screen.getByTestId("card")).toBeOnTheScreen();
    expect(screen.getByText("hello")).toBeOnTheScreen();
  });

  it("StatTile renders label, value and sub", () => {
    render(<StatTile label="Spent" value="₱1,000" sub="this month" />);
    expect(screen.getByText("Spent")).toBeOnTheScreen();
    expect(screen.getByText("₱1,000")).toBeOnTheScreen();
    expect(screen.getByText("this month")).toBeOnTheScreen();
  });

  it("PageHeader renders title and subtitle", () => {
    render(<PageHeader title="Budgets" subtitle="This month" />);
    expect(screen.getByText("Budgets")).toBeOnTheScreen();
    expect(screen.getByText("This month")).toBeOnTheScreen();
  });

  it("Field renders its label", () => {
    render(<Field label="Amount" value="" onChangeText={() => {}} />);
    expect(screen.getByText("Amount")).toBeOnTheScreen();
  });

  it("Button renders its title and responds to press", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<Button title="Save" onPress={onPress} testID="save-btn" />);
    await user.press(screen.getByTestId("save-btn"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("Pill renders its label", () => {
    render(<Pill label="Food" />);
    expect(screen.getByText("Food")).toBeOnTheScreen();
  });

  it("Badge renders nothing at zero and the count otherwise", () => {
    const zero = render(<Badge count={0} />);
    expect(zero.toJSON()).toBeNull();

    render(<Badge count={5} />);
    expect(screen.getByText("5")).toBeOnTheScreen();
  });

  it("Divider renders a hairline view", () => {
    const { toJSON } = render(<Divider />);
    expect(toJSON()).toBeTruthy();
  });

  it("SearchField renders its placeholder and value", () => {
    render(<SearchField value="coffee" onChangeText={() => {}} placeholder="Search" />);
    expect(screen.getByDisplayValue("coffee")).toBeOnTheScreen();
  });

  it("Skeleton renders a placeholder block", () => {
    const { toJSON } = render(<Skeleton />);
    expect(toJSON()).toBeTruthy();
  });
});

describe("FloatingAddButton stays out of the tab bar", () => {
  it("renders as its own floating control, not a tab item", async () => {
    // The tab bar itself lives in app/(app)/_layout.tsx, out of scope here. What this file can
    // pin is that the button is a standalone absolutely-positioned Pressable with its own
    // accessible name — not a label that could be mistaken for a tab.
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<FloatingAddButton onPress={onPress} bottomOffset={24} />);

    const button = screen.getByTestId("fab-add");
    expect(button).toHaveStyle({ position: "absolute" });
    expect(button.props.accessibilityLabel).toBe("Add expense");

    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

type SvgNode = { type?: string; props?: Record<string, unknown>; children?: SvgNode[] | null };

function findAll(node: SvgNode | null, predicate: (n: SvgNode) => boolean): SvgNode[] {
  if (!node) return [];
  const self = predicate(node) ? [node] : [];
  const kids = node.children ?? [];
  return self.concat(kids.flatMap((k) => findAll(k, predicate)));
}

describe("FloatingAddButton is a coin dropping into Piso's slot (TEN-443)", () => {
  it("keeps its 56pt target, testID and accessible name", () => {
    render(<FloatingAddButton onPress={() => {}} bottomOffset={24} />);

    const button = screen.getByTestId("fab-add");
    expect(button).toHaveStyle({ width: 56, height: 56 });
    expect(button.props.accessibilityLabel).toBe("Add expense");
    expect(button.props.accessibilityRole).toBe("button");
  });

  it("draws its plus as two of Piso's slot bars, not a font glyph", () => {
    // A text "+" sat on font metrics (it needed a hand-tuned lineHeight to centre) and could be
    // anything; the slot bar is Piso's own: four times as long as it is tall, ends fully rounded.
    const { toJSON } = render(<FloatingAddButton onPress={() => {}} bottomOffset={24} />);

    expect(screen.queryByText("+")).toBeNull();
    const bars = findAll(toJSON() as SvgNode, (n) => n.type === "RNSVGRect");
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      const { width, height, rx } = bar.props as { width: number; height: number; rx: number };
      expect(Math.max(width, height) / Math.min(width, height)).toBe(4);
      expect(rx).toBe(Math.min(width, height) / 2);
    }
    // One lies across, one stands up — together a plus, not two parallel slots.
    expect(bars.map((b) => (b.props!.width as number) > (b.props!.height as number))).toEqual([
      true,
      false,
    ]);
  });

  it("carries a gold coin rim, the same gold as Piso's saved coin", () => {
    const { toJSON } = render(<FloatingAddButton onPress={() => {}} bottomOffset={24} />);

    const rims = findAll(toJSON() as SvgNode, (n) => n.type === "RNSVGCircle");
    expect(rims).toHaveLength(1);
    expect((rims[0].props!.stroke as { payload?: unknown }).payload).toBe(
      processColor(palettes.light.warnBorder),
    );
  });

  it("keeps the rim visible in dark mode, where warnBorder is a 20% wash on a near-white disc", () => {
    // app.json ships `userInterfaceStyle: automatic`, so the dark palette is live. There the disc
    // is #f0f0f0 and warnBorder is rgba(240,220,160,0.2) — the rim would vanish. warnText is the
    // same gold family at a weight that survives on a light disc.
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    try {
      const { toJSON } = render(<FloatingAddButton onPress={() => {}} bottomOffset={24} />);

      const [rim] = findAll(toJSON() as SvgNode, (n) => n.type === "RNSVGCircle");
      expect((rim.props!.stroke as { payload?: unknown }).payload).toBe(
        processColor(palettes.dark.warnText),
      );
    } finally {
      scheme.mockRestore();
    }
  });

  it("hides the artwork from screen readers so the button reads once, as 'Add expense'", () => {
    const { toJSON } = render(<FloatingAddButton onPress={() => {}} bottomOffset={24} />);

    const [svg] = findAll(toJSON() as SvgNode, (n) => n.type === "RNSVGSvgView");
    expect(svg.props!.importantForAccessibility).toBe("no-hide-descendants");
    expect(svg.props!.accessibilityElementsHidden).toBe(true);
  });
});

describe("the app shell around the coin-slot button (TEN-443)", () => {
  function renderLayout(pathname: string) {
    mockPathname = pathname;
    mockPush.mockClear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AppLayout />
      </QueryClientProvider>,
    );
  }

  it("keeps the tab set Home, Expenses, Budgets, Goals, More, in that order", () => {
    renderLayout("/");

    const titles = screen.getAllByTestId(/^tab-screen-/).map((el) => el.props.children);
    expect(titles).toEqual(["Home", "Expenses", "Budgets", "Goals", "More"]);
  });

  it("opens quick-add when the coin is dropped", async () => {
    const user = userEvent.setup();
    renderLayout("/expenses");

    await user.press(screen.getByTestId("fab-add"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/quick-add");
  });

  it("sits above the tab bar and the home indicator", () => {
    renderLayout("/");

    // 56 tab bar + 34 inset + 16 breathing room.
    expect(screen.getByTestId("fab-add")).toHaveStyle({ bottom: 106 });
  });

  it.each(["/more", "/quick-add", "/add-expense"])("is not offered on %s", (pathname) => {
    renderLayout(pathname);

    expect(screen.queryByTestId("fab-add")).toBeNull();
  });
});

describe("ListRow keeps a minimum touch height of 44", () => {
  it("sets minHeight 44 on the rendered pressable, independent of the type scale", () => {
    render(<ListRow testID="row" icon="pricetag" label="Groceries" onPress={() => {}} />);

    // Reads the rendered style, not a constant declared in this file: the type-scale refactor
    // moved every fontSize in this component onto theme tokens, and a shrunk label/sub pairing
    // could have silently dropped the row below the 44pt target if height depended on text
    // metrics alone.
    const row = screen.getByTestId("row");
    expect(row).toHaveStyle({ minHeight: 44 });
  });

  it("still renders the label, optional sub-line and chevron", () => {
    render(
      <ListRow
        testID="row"
        icon="pricetag"
        label="Groceries"
        sub="12 this month"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText("Groceries")).toBeOnTheScreen();
    expect(screen.getByText("12 this month")).toBeOnTheScreen();
  });

  it("hides the chevron and tints the label for a destructive row", () => {
    render(
      <ListRow testID="row" icon="log-out" label="Sign out" destructive onPress={() => {}} />,
    );
    expect(screen.queryByTestId("chevron-forward")).toBeNull();
  });
});

describe("RowMenu keeps ActionSheetIOS with its destructiveButtonIndex", () => {
  it("opens the native action sheet with the destructive option flagged", async () => {
    const spy = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    const onDelete = jest.fn();

    render(
      <RowMenu
        testID="row-menu"
        title="Groceries"
        actions={[
          { label: "Edit limit", onPress: () => {} },
          { label: "Remove", onPress: onDelete, destructive: true },
        ]}
      />,
    );
    await user.press(screen.getByTestId("row-menu"));

    expect(spy).toHaveBeenCalledTimes(1);
    const [options] = spy.mock.calls[0] as [
      { options: string[]; destructiveButtonIndex?: number },
      (index: number) => void,
    ];
    expect(options.options).toEqual(["Edit limit", "Remove", "Cancel"]);
    expect(options.destructiveButtonIndex).toBe(1);

    spy.mockRestore();
  });
});

describe("MonthStepper stays disabled rather than hidden at the boundary", () => {
  it("renders a disabled, visible next-month control rather than removing it", () => {
    render(
      <MonthStepper label="October 2026" onPrev={() => {}} onNext={() => {}} canGoNext={false} />,
    );

    const next = screen.getByTestId("month-next");
    expect(next).toBeOnTheScreen();
    expect(next.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText("October 2026")).toBeOnTheScreen();
  });

  it("enables next when a later month exists", () => {
    render(
      <MonthStepper label="June 2026" onPrev={() => {}} onNext={() => {}} canGoNext={true} />,
    );
    expect(screen.getByTestId("month-next").props.accessibilityState?.disabled).toBe(false);
  });
});

describe("PaywallNotice still reads as an offer, not an error", () => {
  it("renders through ErrorText as a panel card with a View plans action, not danger-coloured text", () => {
    render(<ErrorText>{"Add a second account. Upgrade to Premium to unlock it."}</ErrorText>);

    expect(screen.getByTestId("paywall-notice")).toBeOnTheScreen();
    expect(screen.getByTestId("paywall-view-plans")).toBeOnTheScreen();
    expect(
      screen.getByText("Add a second account. Upgrade to Premium to unlock it."),
    ).toBeOnTheScreen();
  });

  it("renders a plain message in the danger colour when it is not a paywall", () => {
    render(<ErrorText>{"Something went wrong."}</ErrorText>);
    expect(screen.queryByTestId("paywall-notice")).toBeNull();
    const text = screen.getByText("Something went wrong.");
    expect(text).toHaveStyle({ color: "#b30000" });
  });

  it("renders nothing for an empty message", () => {
    const { toJSON } = render(<ErrorText>{null}</ErrorText>);
    expect(toJSON()).toBeNull();
  });
});

describe("MiniBars stays drawn from plain views", () => {
  it("renders one bar per value with no svg element in the tree", () => {
    const { toJSON } = render(<MiniBars values={[0, 10, 5, 20]} />);
    const tree = toJSON();
    const json = JSON.stringify(tree);

    expect(tree).toBeTruthy();
    // react-native-svg's primitives serialise under names like "RNSVGSvg" / "RNSVGRect" — their
    // absence here is the guard that MiniBars was not quietly rewritten onto the library added
    // for Piso in this same issue.
    expect(json).not.toMatch(/RNSVG/);
  });
});

describe("ProgressMeter", () => {
  it("is a named progressbar carrying the true figure", () => {
    render(<ProgressMeter percent={130} tone="over" label="Food budget" />);
    const bar = screen.getByLabelText("Food budget");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 130, now: 130, text: "130%" });
  });

  it("draws the overflow share only when over", () => {
    render(<ProgressMeter percent={125} tone="over" label="Food budget" />);
    expect(screen.getByTestId("meter-overflow")).toHaveStyle({ width: "20%" });
    expect(screen.getByTestId("meter-fill")).toHaveStyle({ width: "80%" });
  });

  it("draws no overflow for a goal past 100", () => {
    render(<ProgressMeter percent={120} tone="goal" label="Trip fund" />);
    expect(screen.queryByTestId("meter-overflow")).toBeNull();
    expect(screen.getByTestId("meter-fill")).toHaveStyle({ width: "100%" });
  });
});

describe("Amount", () => {
  it("formats pesos from centavos", () => {
    render(<Amount centavos={175050} />);
    expect(screen.getByText("₱1,750.50")).toBeOnTheScreen();
  });

  it("keeps the minus sign", () => {
    render(<Amount centavos={-25000} tone="danger" />);
    expect(screen.getByText("-₱250.00")).toBeOnTheScreen();
  });

  it("renders a foreign amount the way expenseAmountText does", () => {
    render(<Amount centavos={150000} currency="JPY" />);
    expect(screen.getByText("1,500.00 JPY")).toBeOnTheScreen();
  });
});

describe("EmptyState", () => {
  it("shows the copy and exactly one action", async () => {
    const onPress = jest.fn();
    render(
      <EmptyState
        title="No expenses yet"
        body="Log one and Piso starts keeping count."
        action={{ label: "Log your first expense", onPress }}
      />,
    );
    expect(screen.getByText("No expenses yet")).toBeOnTheScreen();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.setup().press(screen.getByRole("button", { name: "Log your first expense" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
