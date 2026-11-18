import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import BudgetSheet from "./BudgetSheet";

/** What the Budgets screen relies on from its sheet: centavos out, and a category when it offers one. */

function renderSheet(props: Partial<Parameters<typeof BudgetSheet>[0]> = {}) {
  const onSubmit = jest.fn();
  render(
    <BudgetSheet
      visible
      title="New budget"
      submitLabel="Set budget"
      initialAmount=""
      categories={[]}
      submitting={false}
      onSubmit={onSubmit}
      onClose={() => {}}
      {...props}
    />,
  );
  return onSubmit;
}

describe("BudgetSheet", () => {
  it("submits the limit as integer centavos", () => {
    const onSubmit = renderSheet();
    fireEvent.changeText(screen.getByTestId("budget-amount"), "1500.50");
    fireEvent.press(screen.getByTestId("budget-save"));
    expect(onSubmit).toHaveBeenCalledWith({ amount: 150050, categoryId: undefined });
  });

  it("asks for a category when it offers some and none is picked", () => {
    const onSubmit = renderSheet({ categories: [{ id: 4, name: "Food" }] });
    fireEvent.changeText(screen.getByTestId("budget-amount"), "1500.50");
    fireEvent.press(screen.getByTestId("budget-save"));
    expect(screen.getByText("Pick a category.")).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
