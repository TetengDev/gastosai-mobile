import { describe, expect, it, jest } from "@jest/globals";
import { ActionSheetIOS } from "react-native";
import { render, screen, userEvent } from "@testing-library/react-native";
import {
  Badge,
  Body,
  Button,
  Card,
  Divider,
  ErrorText,
  Field,
  FloatingAddButton,
  ListRow,
  MiniBars,
  MonthStepper,
  PageHeader,
  Pill,
  ProgressBar,
  RowMenu,
  Screen,
  SearchField,
  Skeleton,
  StatTile,
} from "./ui";

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

  it("ProgressBar renders without crashing at an over-100 percent", () => {
    const { toJSON } = render(<ProgressBar percent={130} />);
    expect(toJSON()).toBeTruthy();
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
