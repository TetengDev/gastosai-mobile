import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../../src/api/client";
import { dismissAlert, listAlerts, markAlertRead } from "../../../src/api/alerts";
import type { AlertResponse } from "../../../src/api/types";
import { formatDayMonth } from "../../../src/lib/formatters";
import { Body, Card, ErrorText, Skeleton } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

/**
 * Budget and bill warnings the backend raised.
 *
 * Severity is server-assigned and only mapped to a colour here — nothing on this screen decides
 * what counts as serious. Read and dismiss stay distinct actions: tapping acknowledges an alert
 * and clears the badge, dismissing removes it from the list entirely, and conflating the two
 * would make a glance destructive.
 */
export default function Alerts() {
  const t = useTheme();
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["alerts"],
    queryFn: listAlerts,
  });

  // Both mutations invalidate the shared ["alerts"] key, which is also what feeds the tab badge,
  // so the badge and the list can never disagree.
  const invalidate = () => qc.invalidateQueries({ queryKey: ["alerts"] });
  const read = useMutation({ mutationFn: markAlertRead, onSuccess: invalidate });
  const dismiss = useMutation({ mutationFn: dismissAlert, onSuccess: invalidate });

  const severityColor = (s: AlertResponse["severity"]) =>
    s === "CRITICAL" ? t.colors.danger : s === "WARNING" ? t.colors.warnText : t.colors.text2;

  const visible = (data ?? []).filter((a) => !a.dismissed);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
    >
      {isLoading && <Skeleton height={120} />}
      <ErrorText>{isError ? errorMessage(error) : null}</ErrorText>

      {!isLoading && !isError && visible.length === 0 && (
        <Card>
          <Body>Nothing needs your attention.</Body>
          <Body dim style={{ fontSize: 12.5 }}>
            Alerts appear here when a budget is close to its limit or a bill is due.
          </Body>
        </Card>
      )}

      {visible.map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: severityColor(a.severity),
              }}
            />
            <Text
              style={{
                fontFamily: t.fonts.mono,
                fontSize: 11,
                letterSpacing: 1.2,
                color: severityColor(a.severity),
              }}
            >
              {a.severity}
            </Text>
            <View style={{ flex: 1 }} />
            {!a.read ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: t.colors.surface4,
                }}
              >
                <Text style={{ fontFamily: t.fonts.body, fontSize: 11, color: t.colors.text2 }}>
                  New
                </Text>
              </View>
            ) : null}
          </View>

          <Body>{a.message}</Body>
          <Body dim style={{ fontSize: 12.5 }}>
            {[a.categoryName, a.createdAt ? formatDayMonth(a.createdAt) : null]
              .filter(Boolean)
              .join(" · ")}
          </Body>

          <View style={{ flexDirection: "row", gap: 18, marginTop: 4 }}>
            {!a.read && a.id != null ? (
              <Pressable
                testID={`alert-read-${a.id}`}
                accessibilityRole="button"
                onPress={() => read.mutate(a.id as number)}
                hitSlop={8}
              >
                <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.link }}>
                  Mark read
                </Text>
              </Pressable>
            ) : null}
            {a.id != null ? (
              <Pressable
                testID={`alert-dismiss-${a.id}`}
                accessibilityRole="button"
                onPress={() => dismiss.mutate(a.id as number)}
                hitSlop={8}
              >
                <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.text2 }}>
                  Dismiss
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Card>
      ))}

      <ErrorText>
        {read.isError
          ? errorMessage(read.error)
          : dismiss.isError
            ? errorMessage(dismiss.error)
            : null}
      </ErrorText>
    </ScrollView>
  );
}
