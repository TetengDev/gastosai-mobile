import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import AmountSheet from "./AmountSheet";

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
});
