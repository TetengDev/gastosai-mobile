import type { components } from "./generated/schema";

/**
 * Type aliases over the generated contract. This file adds **no shapes of its own** — it only
 * gives readable names to `components["schemas"][...]`, so call sites do not carry that
 * indexing noise.
 *
 * If you find yourself declaring a request or response shape here, stop: it belongs in the
 * backend's OpenAPI spec, published as a new contract version (CONTRACT.md). Hand-writing it
 * here is exactly the drift the polyrepo split exists to prevent.
 */
type Schemas = components["schemas"];

export type AuthResponse = Schemas["AuthResponse"];
export type LoginRequest = Schemas["LoginRequest"];
export type RegisterRequest = Schemas["RegisterRequest"];
export type ExpenseRequest = Schemas["ExpenseRequest"];
export type ExpenseResponse = Schemas["ExpenseResponse"];
export type CategoryResponse = Schemas["CategoryResponse"];
export type MonthlyReportItem = Schemas["MonthlyReportItem"];
export type CategoryReportItem = Schemas["CategoryReportItem"];
export type ParseExpenseRequest = Schemas["ParseExpenseRequest"];
export type ParsedExpenseResult = Schemas["ParsedExpenseResult"];
export type BudgetSummaryResponse = Schemas["BudgetSummaryResponse"];
export type BudgetSummaryItem = Schemas["BudgetSummaryItem"];
export type GoalResponse = Schemas["GoalResponse"];
export type AlertResponse = Schemas["AlertResponse"];
export type BudgetRequest = Schemas["BudgetRequest"];
export type BudgetResponse = Schemas["BudgetResponse"];
export type GoalRequest = Schemas["GoalRequest"];
export type CategoryRequest = Schemas["CategoryRequest"];
export type RecurringExpenseRequest = Schemas["RecurringExpenseRequest"];
export type RecurringExpenseResponse = Schemas["RecurringExpenseResponse"];
export type UpcomingBill = Schemas["UpcomingBillResponse"];
export type ChatRequest = Schemas["ChatRequest"];
export type ChatResponse = Schemas["ChatResponse"];
