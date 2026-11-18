import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import AmountSheet from "./AmountSheet";
import { palettes } from "../theme";

/** What the Goals screen relies on from its sheet: centavos out, with the label, and nothing past centavos. */

function renderSheet(props: Partial<Parameters<typeof AmountSheet>[0]> = {}) {
  const onSubmit = jest.fn();
  render(
    <AmountSheet
      visible
      title="New goal"
      labelField="Goal name"
      labelPlaceholder="Emergency fund"
      submitLabel="Create goal"
      submitting={false}
      onSubmit={onSubmit}
      onClose={() => {}}
      {...props}
    />,
  );
  return onSubmit;
}

describe("AmountSheet", () => {
  it("submits the amount as integer centavos, with the label", () => {
    const onSubmit = renderSheet();
    fireEvent.changeText(screen.getByTestId("sheet-amount"), "2500");
    fireEvent.changeText(screen.getByTestId("sheet-label"), "Japan trip");
    fireEvent.press(screen.getByTestId("sheet-save"));
    expect(onSubmit).toHaveBeenCalledWith({ amount: 250_000, label: "Japan trip" });
  });

  // A peso has two decimal places. A third keystroke is refused rather than rounded into a
  // centavo the user never typed.
  it("refuses a third decimal place", () => {
    const onSubmit = renderSheet();
    fireEvent.changeText(screen.getByTestId("sheet-amount"), "25.00");
    fireEvent.changeText(screen.getByTestId("sheet-amount"), "25.005");
    fireEvent.changeText(screen.getByTestId("sheet-label"), "Japan trip");
    fireEvent.press(screen.getByTestId("sheet-save"));
    expect(screen.getByTestId("sheet-amount").props.value).toBe("25.00");
    expect(onSubmit).toHaveBeenCalledWith({ amount: 2_500, label: "Japan trip" });
  });

  // Contributing asks for one thing, the amount; the goal is already known.
  it("submits the amount alone when it has no label field", () => {
    const onSubmit = renderSheet({ labelField: undefined, labelPlaceholder: undefined });
    expect(screen.queryByTestId("sheet-label")).toBeNull();
    fireEvent.changeText(screen.getByTestId("sheet-amount"), "500");
    fireEvent.press(screen.getByTestId("sheet-save"));
    expect(onSubmit).toHaveBeenCalledWith({ amount: 50_000, label: "" });
  });

  // Design review, fix round 1. Text3 on the dark sheet and the link blue on its accessory bar
  // both fall under 4.5:1; the review asked for text2 and textHi.
  it("draws the AMOUNT label in text2 and Done in textHi", () => {
    renderSheet();
    expect(StyleSheet.flatten(screen.getByText("AMOUNT").props.style).color).toBe(palettes.light.text2);
    expect(StyleSheet.flatten(screen.getByText("Done").props.style).color).toBe(palettes.light.textHi);
  });

  it("gives Cancel and Done a 44 pt target of their own", () => {
    renderSheet();
    for (const id of ["sheet-cancel", "sheet-amount-done"]) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style)).toMatchObject({
        minHeight: 44,
        justifyContent: "center",
      });
    }
  });

  it("names the amount field for a screen reader", () => {
    renderSheet();
    expect(screen.getByLabelText("Amount in pesos")).toBe(screen.getByTestId("sheet-amount"));
  });

  // Web parity (controller ruling): a goal in another currency names its own symbol.
  it("names the field and its symbol after a goal's own currency", () => {
    renderSheet({ currency: "USD" });
    expect(screen.getByLabelText("Amount ($)")).toBe(screen.getByTestId("sheet-amount"));
    expect(screen.getByText("$")).toBeOnTheScreen();
    expect(screen.queryByText("₱")).toBeNull();
  });

  it("falls back to the code for a currency with no symbol", () => {
    renderSheet({ currency: "KRW" });
    expect(screen.getByLabelText("Amount (KRW)")).toBe(screen.getByTestId("sheet-amount"));
  });

  it("stays in pesos for a PHP goal", () => {
    renderSheet({ currency: "PHP" });
    expect(screen.getByLabelText("Amount in pesos")).toBe(screen.getByTestId("sheet-amount"));
    expect(screen.getByText("₱")).toBeOnTheScreen();
  });
});
