import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../../src/api/client";
import {
  deleteRecurring,
  listRecurring,
  updateRecurring,
  upcomingBills,
} from "../../../src/api/recurring";
import type { RecurringExpenseRequest, RecurringExpenseResponse } from "../../../src/api/types";
import { currentMonth, formatCurrency, formatDateOnly } from "../../../src/lib/formatters";
import { Body, Card, Divider, ErrorText, Pill, Skeleton } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

/**
 * Bills and subscriptions.
 *
 * **Upcoming leads.** "What is due soon" is the question worth asking on a phone; the full list of
 * definitions is reference material and sits below it. Web puts them the other way round, which is
 * right for a screen you sit down in front of.
 *
 * Every due date comes from `GET /recurring/upcoming` — the backend works them out from frequency
 * and day. Deriving them here from `dayOfMonth` would disagree with every other surface the moment
 * a short month or a leap year is involved, and it is business logic besides (CLAUDE.md §1.2).
 */
export default function Recurring() {
  const t = useTheme();
  const qc = useQueryClient();
  const month = currentMonth();

  const upcoming = useQuery({
    queryKey: ["recurring", "upcoming", month],
    queryFn: () => upcomingBills(month),
  });
  const all = useQuery({ queryKey: ["recurring"], queryFn: listRecurring });

  const [busyId, setBusyId] = useState<number | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recurring"] });
    setBusyId(null);
  };

  // Pausing sends the whole bill back with `active` flipped: PUT takes a full representation, and
  // sending a partial one would blank whatever was left out.
  const toggleActive = useMutation({
    mutationFn: ({ id, body }: { id: number; body: RecurringExpenseRequest }) =>
      updateRecurring(id, body),
    onSuccess: invalidate,
    onError: () => setBusyId(null),
  });

  /**
   * The response types `name`, `amount` and `frequency` as optional while the request requires
   * them, so a row has to be checked before it can be sent back. Returning null rather than
   * casting keeps a malformed row from being PUT with `undefined` in a required field, which the
   * API would reject with a validation error the user could do nothing about.
   */
  const toRequest = (r: RecurringExpenseResponse): RecurringExpenseRequest | null => {
    if (!r.name || r.amount == null || !r.frequency) return null;
    return {
      name: r.name,
      amount: r.amount,
      frequency: r.frequency,
      categoryName: r.categoryName,
      dayOfMonth: r.dayOfMonth,
      dayOfWeek: r.dayOfWeek,
      monthOfYear: r.monthOfYear,
      currency: r.currency,
      exchangeRate: r.exchangeRate,
      active: !r.active,
    };
  };

  const remove = useMutation({
    mutationFn: deleteRecurring,
    onSuccess: invalidate,
    onError: () => setBusyId(null),
  });

  const confirmDelete = (r: RecurringExpenseResponse) =>
    Alert.alert(`Delete “${r.name}”?`, "This stops it appearing in upcoming bills.", [
      { text: "Cancel", style: "cancel" },
      {
        // Named, not a bare "Delete": each row carries its own Delete link.
        text: "Delete bill",
        style: "destructive",
        onPress: () => {
          setBusyId(r.id ?? null);
          remove.mutate(r.id as number);
        },
      },
    ]);

  /** How often, in words. `dayOfMonth`/`dayOfWeek` are only ever displayed, never used to compute a date. */
  const schedule = (r: RecurringExpenseResponse) => {
    if (r.frequency === "WEEKLY") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const d = r.dayOfWeek != null ? days[r.dayOfWeek % 7] : null;
      return d ? `Weekly on ${d}` : "Weekly";
    }
    if (r.frequency === "YEARLY") return "Yearly";
    return r.dayOfMonth != null ? `Monthly on day ${r.dayOfMonth}` : "Monthly";
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
    >
      <Card>
        <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
          Due this month
        </Text>
        {upcoming.isLoading && <Skeleton height={100} />}
        <ErrorText>{upcoming.isError ? errorMessage(upcoming.error) : null}</ErrorText>
        {!upcoming.isLoading && !upcoming.isError && (upcoming.data ?? []).length === 0 && (
          <Body dim>Nothing due for the rest of the month.</Body>
        )}
        {(upcoming.data ?? []).map((b, i) => (
          <View
            key={`${b.id}-${b.dueDate}-${i}`}
            style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Body numberOfLines={1}>{b.name}</Body>
              <Body dim style={{ fontSize: 12.5 }}>
                {[b.categoryName, b.dueDate ? formatDateOnly(b.dueDate) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Body>
            </View>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
              {formatCurrency(b.amount ?? 0)}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={{ fontFamily: t.fonts.bodySemi, fontSize: 15, color: t.colors.textHi }}>
          All recurring
        </Text>
        {all.isLoading && <Skeleton height={140} />}
        <ErrorText>{all.isError ? errorMessage(all.error) : null}</ErrorText>
        {!all.isLoading && !all.isError && (all.data ?? []).length === 0 && (
          <Body dim>No recurring bills yet. Add them on the web app.</Body>
        )}
        {(all.data ?? []).map((r, i) => (
          <View key={r.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ paddingVertical: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Body numberOfLines={1}>{r.name}</Body>
                  <Body dim style={{ fontSize: 12.5 }}>
                    {schedule(r)}
                    {r.categoryName ? ` · ${r.categoryName}` : ""}
                  </Body>
                </View>
                <Text style={{ fontFamily: t.fonts.display, fontSize: 15, color: t.colors.textHi }}>
                  {formatCurrency(r.amount ?? 0)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {r.active ? null : <Pill label="Paused" />}
                <View style={{ flex: 1 }} />
                <Pressable
                  testID={`recurring-toggle-${r.id}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={busyId === r.id}
                  onPress={() => {
                    const body = toRequest(r);
                    if (!body || r.id == null) return;
                    setBusyId(r.id);
                    toggleActive.mutate({ id: r.id, body });
                  }}
                >
                  <Text
                    style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.link }}
                  >
                    {r.active ? "Pause" : "Resume"}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`recurring-delete-${r.id}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={busyId === r.id}
                  onPress={() => confirmDelete(r)}
                >
                  <Text
                    style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.danger }}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <ErrorText>
        {toggleActive.isError
          ? errorMessage(toggleActive.error)
          : remove.isError
            ? errorMessage(remove.error)
            : null}
      </ErrorText>
    </ScrollView>
  );
}
