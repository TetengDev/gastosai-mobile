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

/**
 * **Every money-carrying alias points at the contract's `*V2` shape**, because `src/api/client.ts`
 * sends every request to `/api/v2`. Those schemas are identical to their v1 twins except that each
 * amount is an `int64` of centavos rather than a decimal — so aliasing the v1 name here would type
 * an amount correctly as a number and be wrong by a factor of a hundred at runtime, which nothing
 * would catch. The alias is the only place that pairing is recorded; keep it in step with the
 * version path.
 *
 * Shapes with no `*V2` twin carry no money and are unversioned: the contract publishes one schema
 * used by both surfaces. Checked field by field against the pinned contract, not assumed — the
 * whole point of the rule is that a decimal reaching `formatCentavos` renders a hundredth of the
 * real figure and nothing fails.
 *
 * **One schema is unversioned and still carries money: `PricingItem.amountCentavos`.** It was an
 * integer of centavos before v2 existed, so it needed no twin — it is aliased in
 * `src/api/subscription.ts` rather than here, and `formatPrice` already sends it through
 * `formatCentavos`.
 */
export type AuthResponse = Schemas["AuthResponse"];
export type LoginRequest = Schemas["LoginRequest"];
export type RegisterRequest = Schemas["RegisterRequest"];
export type ExpenseRequest = Schemas["ExpenseRequestV2"];
export type ExpenseResponse = Schemas["ExpenseResponseV2"];
export type CategoryResponse = Schemas["CategoryResponse"];
export type MonthlyReportItem = Schemas["MonthlyReportItemV2"];
export type DailyReportItem = Schemas["DailyReportItemV2"];
export type MonthlyComparison = Schemas["MonthlyComparisonResponseV2"];
export type MonthSummaryInsight = Schemas["MonthSummaryInsightResponse"];
export type TopCategoryInsight = Schemas["TopCategoryInsightResponseV2"];
export type CategoryReportItem = Schemas["CategoryReportItemV2"];
export type ParseExpenseRequest = Schemas["ParseExpenseRequest"];
export type ParsedExpenseResult = Schemas["ParsedExpenseResultV2"];
export type BudgetSummaryResponse = Schemas["BudgetSummaryResponseV2"];
export type BudgetSummaryItem = Schemas["BudgetSummaryItemV2"];
export type GoalResponse = Schemas["GoalResponseV2"];
export type AlertResponse = Schemas["AlertResponse"];
export type BudgetRequest = Schemas["BudgetRequestV2"];
export type BudgetResponse = Schemas["BudgetResponseV2"];
export type GoalRequest = Schemas["GoalRequestV2"];
export type CategoryRequest = Schemas["CategoryRequest"];
export type RecurringExpenseRequest = Schemas["RecurringExpenseRequestV2"];
export type RecurringExpenseResponse = Schemas["RecurringExpenseResponseV2"];
export type UpcomingBill = Schemas["UpcomingBillResponseV2"];
export type ChatRequest = Schemas["ChatRequest"];
export type ChatResponse = Schemas["ChatResponseV2"];
