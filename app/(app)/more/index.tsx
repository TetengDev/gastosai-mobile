import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listAlerts, unreadCount } from "../../../src/api/alerts";
import { errorMessage } from "../../../src/api/client";
import {
  describeSubscription,
  formatPrice,
  getPricing,
  getSubscription,
  PERIOD_CADENCE,
  startCheckout,
  subscriptionChanged,
} from "../../../src/api/subscription";
import type { BillingPeriod, SubscriptionResponse } from "../../../src/api/subscription";
import { useAuth } from "../../../src/context/AuthContext";
import {
  Body,
  Button,
  Card,
  Divider,
  ErrorText,
  ListRow,
  Pill,
  Skeleton,
} from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

/** The one query key the plan card, the upgrade sheet and its polling all share. */
const SUBSCRIPTION_KEY = ["subscription"];

/** How many times we re-ask the backend after a checkout, and how far apart. */
const MAX_CHECKS = 6;
const CHECK_INTERVAL_MS = 3000;

/**
 * What Premium buys, as copy.
 *
 * Pinned at build time and therefore going stale is a real cost on mobile (CLAUDE.md §1.5) — an
 * installed app advertises this list for months. It is tolerable only because it is *marketing*:
 * nothing here gates anything, and the backend remains the sole authority on what a plan actually
 * unlocks. If it ever needs to be current, it belongs in the pricing payload, not in this array.
 */
const PREMIUM_FEATURES = [
  "Unlimited expenses",
  "AI insights and the spending assistant",
  "Budget forecasting and trends",
  "Receipt capture without limits",
  "CSV and PDF export",
];

/**
 * Plans, and the hand-off to the payment provider.
 *
 * A modal rather than a route, and deliberately so: a full-screen sheet is the shape a phone user
 * already reads as "a decision, then back to what I was doing", and it survives the round trip to
 * an external browser without the app's navigation state being the thing that has to remember
 * where we were.
 *
 * The flow it manages has four states because the round trip genuinely has four. `browsing` is the
 * price list. `handingOff` is the window in which the app is in the background and the provider
 * owns the transaction — we know nothing during it and say nothing. `confirming` starts when the
 * user comes back and re-asks the backend, because the truth arrives by webhook and may lag the
 * user by seconds. `settled` reports what the backend actually said.
 *
 * Nothing here decides an entitlement. The only question asked is whether the authoritative
 * subscription moved (`subscriptionChanged`), which is why a cancelled payment produces an honest
 * "nothing was charged" rather than a guess.
 */
function UpgradeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<"browsing" | "handingOff" | "confirming" | "settled">(
    "browsing",
  );
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [checks, setChecks] = useState(0);
  const [landed, setLanded] = useState(false);

  // What the backend said before we handed off. The comparison point for "did anything happen?",
  // captured from the cache the plan card already filled rather than costing another request.
  const before = useRef<SubscriptionResponse | undefined>(undefined);

  const pricing = useQuery({
    queryKey: ["subscription", "pricing"],
    queryFn: getPricing,
    // Nothing to price until the sheet is on screen, and the price list is stable enough that
    // re-opening the sheet in one session should not re-fetch it.
    enabled: visible,
    staleTime: 5 * 60 * 1000,
  });

  const current = queryClient.getQueryData<SubscriptionResponse>(SUBSCRIPTION_KEY);
  const summary = describeSubscription(current);

  // Whatever the backend published, in the order it published it, with the two periods we know how
  // to label pulled out by name. A period the pinned contract does not describe simply has no
  // toggle, which is the safe direction: an unpriceable plan is not offered.
  const options = (pricing.data ?? []).filter(
    (p): p is typeof p & { period: BillingPeriod } => p.period === "MONTHLY" || p.period === "ANNUAL",
  );
  // Falling back to the first published option keeps the screen coherent if monthly is ever not
  // among them: the toggle, the price and the button then all agree on one period, instead of the
  // default sitting on something with no price behind it.
  const selected = options.find((p) => p.period === period) ?? options[0];
  const effectivePeriod = selected?.period ?? period;

  /**
   * Only a *return* counts as a return.
   *
   * `AppState` reports `active` for reasons that are not the user coming back — and on iOS the
   * transition out of the app after `openURL` is not instantaneous, so a listener attached at
   * hand-off time can see an `active` that was never preceded by a departure. Requiring a
   * non-active state first means we never start confirming a checkout the user has not yet had
   * the chance to complete.
   */
  useEffect(() => {
    if (phase !== "handingOff") return;
    let left = false;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        left = true;
        return;
      }
      if (left) setPhase("confirming");
    });
    return () => sub.remove();
  }, [phase]);

  /**
   * Re-ask the backend until it has caught up with the provider, or until we have asked enough.
   *
   * Polling rather than trusting the redirect, because the redirect is the *user's* browser and
   * the activation is a webhook — the two are independent, and the webhook usually wins by a
   * second or two but is not guaranteed to. A network failure mid-poll is not an answer, so it
   * costs an attempt and nothing more.
   */
  useEffect(() => {
    if (phase !== "confirming") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const tick = async () => {
      try {
        const sub = await getSubscription();
        if (!active) return;
        // Feed the shared cache so the plan card behind the sheet updates with it, rather than
        // showing a stale plan the moment this closes.
        queryClient.setQueryData(SUBSCRIPTION_KEY, sub);
        if (subscriptionChanged(before.current, sub)) {
          setLanded(true);
          setPhase("settled");
          return;
        }
      } catch {
        // Keep asking. A transient failure says nothing about the payment.
      }
      if (!active) return;
      attempts += 1;
      setChecks(attempts);
      if (attempts < MAX_CHECKS) timer = setTimeout(tick, CHECK_INTERVAL_MS);
      else setPhase("settled");
    };

    setChecks(0);
    tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, queryClient]);

  const handOff = async () => {
    setCheckoutError(null);
    setStarting(true);
    try {
      before.current = queryClient.getQueryData<SubscriptionResponse>(SUBSCRIPTION_KEY);
      const { checkoutUrl } = await startCheckout(effectivePeriod);
      if (!checkoutUrl) throw new Error("no url");
      await Linking.openURL(checkoutUrl);
      setPhase("handingOff");
    } catch (err) {
      // Two different failures, one message each: the backend refused to open a session, or the
      // phone had nowhere to open the URL. Either way the user is still on a working screen.
      setCheckoutError(
        err instanceof Error && err.message === "no url"
          ? "The server did not return a payment link. Please try again."
          : errorMessage(err, "Could not open the payment page. Please try again."),
      );
    } finally {
      setStarting(false);
    }
  };

  const backToPlans = () => {
    setPhase("browsing");
    setLanded(false);
    setCheckoutError(null);
  };

  const close = () => {
    // Whatever the sheet ended on, the hub behind it should not be showing a plan we now know is
    // out of date.
    queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY });
    backToPlans();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: t.colors.page, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: t.spacing.screen,
            paddingVertical: 12,
          }}
        >
          <Text style={{ flex: 1, fontFamily: t.fonts.display, fontSize: 20, color: t.colors.textHi }}>
            Plans
          </Text>
          <Pressable
            testID="upgrade-close"
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color={t.colors.textHi} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: t.spacing.screen,
            paddingTop: 0,
            gap: t.spacing.gap,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* The same summary the hub shows, so the sheet opens by answering "what am I on now?"
              before it asks for anything. */}
          <Card testID="upgrade-current">
            <Body dim style={{ fontSize: 12.5 }}>Current plan</Body>
            <Text style={{ fontFamily: t.fonts.display, fontSize: 22, color: t.colors.textHi }}>
              {summary.plan}
            </Text>
            {summary.detail ? <Body style={{ fontSize: 13 }}>{summary.detail}</Body> : null}
          </Card>

          {phase === "browsing" ? (
            <PlanChooser
              pricing={pricing}
              options={options}
              selected={selected}
              period={effectivePeriod}
              onPeriod={setPeriod}
              onContinue={handOff}
              starting={starting}
              error={checkoutError}
            />
          ) : null}

          {phase === "handingOff" ? (
            <Card testID="upgrade-handoff">
              <Body>Finish the payment in your browser, then come back here.</Body>
              <Body dim style={{ fontSize: 13 }}>
                We will check your plan automatically when you return.
              </Body>
              <View style={{ marginTop: 8 }}>
                <Button title="Back to plans" variant="secondary" onPress={backToPlans} />
              </View>
            </Card>
          ) : null}

          {phase === "confirming" ? (
            <Card testID="upgrade-confirming">
              <Body>Checking your plan…</Body>
              <Body dim style={{ fontSize: 13 }}>
                This usually takes a few seconds. Checked {checks} of {MAX_CHECKS} times.
              </Body>
            </Card>
          ) : null}

          {phase === "settled" ? (
            <Card testID="upgrade-outcome">
              {landed ? (
                <>
                  <Text
                    style={{ fontFamily: t.fonts.display, fontSize: 20, color: t.colors.textHi }}
                  >
                    Your plan is updated
                  </Text>
                  {/* The backend's own words for the new state, not a claim of our own. */}
                  <Body>
                    {describeSubscription(
                      queryClient.getQueryData<SubscriptionResponse>(SUBSCRIPTION_KEY),
                    ).detail || "You are all set."}
                  </Body>
                  <View style={{ marginTop: 8 }}>
                    <Button title="Done" onPress={close} testID="upgrade-done" />
                  </View>
                </>
              ) : (
                <>
                  <Text
                    style={{ fontFamily: t.fonts.display, fontSize: 20, color: t.colors.textHi }}
                  >
                    Nothing has changed yet
                  </Text>
                  {/* Deliberately covers both endings, because from here they are genuinely
                      indistinguishable: a cancelled payment and a payment still being confirmed
                      look identical to this app. Claiming either one would be a guess, and the
                      guess that costs the user is "you have been charged". */}
                  <Body>
                    If you cancelled, nothing was charged. If you did pay, it can take a moment to
                    come through.
                  </Body>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Check again"
                        onPress={() => setPhase("confirming")}
                        testID="upgrade-recheck"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button title="Back to plans" variant="secondary" onPress={backToPlans} />
                    </View>
                  </View>
                </>
              )}
            </Card>
          ) : null}

          <Body dim style={{ fontSize: 12.5 }}>
            Payments are handled by PayMongo. Cancel anytime.
          </Body>
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * The price list and the one button that leaves the app.
 *
 * Split out so the sheet's state machine above reads as a state machine. Every figure on it is a
 * field from `GET /subscription/pricing` formatted for display — no discount is computed, no
 * annual-versus-monthly saving is derived. Those would be numbers this app invented, and inventing
 * a number is the one thing a client here must not do (CLAUDE.md §1.2); if the saving is worth
 * showing, the backend should publish it.
 */
function PlanChooser({
  pricing,
  options,
  selected,
  period,
  onPeriod,
  onContinue,
  starting,
  error,
}: {
  pricing: { isLoading: boolean; isError: boolean; error: unknown };
  options: { period: BillingPeriod; amountCentavos?: number }[];
  selected: { amountCentavos?: number } | undefined;
  period: BillingPeriod;
  onPeriod: (p: BillingPeriod) => void;
  onContinue: () => void;
  starting: boolean;
  error: string | null;
}) {
  const t = useTheme();

  if (pricing.isLoading) return <Skeleton height={220} />;

  if (pricing.isError) {
    return (
      <Card testID="upgrade-pricing-error">
        <Body>{errorMessage(pricing.error, "Could not load pricing. Please try again.")}</Body>
      </Card>
    );
  }

  if (!options.length) {
    return (
      <Card testID="upgrade-pricing-empty">
        <Body>No plans are available right now.</Body>
      </Card>
    );
  }

  return (
    <Card testID="upgrade-plans">
      <Body dim style={{ fontSize: 12.5 }}>Premium</Body>

      {/* Both billing periods, always rendered when the backend published both — the annual option
          existing at all is the reason this screen was asked for. */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {options.map((p) => (
          <Pill
            key={p.period}
            testID={`upgrade-period-${p.period.toLowerCase()}`}
            label={p.period === "MONTHLY" ? "Monthly" : "Annual"}
            selected={period === p.period}
            onPress={() => onPeriod(p.period)}
          />
        ))}
      </View>

      <Text
        testID="upgrade-price"
        style={{
          fontFamily: t.fonts.display,
          fontSize: 36,
          letterSpacing: -0.6,
          color: t.colors.textHi,
          marginTop: 10,
        }}
      >
        {formatPrice(selected)}
      </Text>
      <Body dim style={{ fontSize: 13 }}>{PERIOD_CADENCE[period]}</Body>

      <View style={{ gap: 8, marginTop: 12 }}>
        {PREMIUM_FEATURES.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
            <Ionicons
              name="checkmark-circle-outline"
              size={17}
              color={t.colors.brand}
              style={{ marginTop: 1 }}
            />
            <Body style={{ flex: 1, fontSize: 14 }}>{f}</Body>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 16 }}>
        <Button
          title="Continue to payment"
          onPress={onContinue}
          loading={starting}
          testID="upgrade-continue"
        />
      </View>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

/**
 * What the user is paying for, at the top of the settings hub.
 *
 * Every word of it comes from `GET /subscription` by way of `describeSubscription` — this
 * component picks a colour and lays the strings out, and decides nothing about plans. Colour is
 * the only judgement it makes, and it is driven by the tone the summary already carries.
 *
 * Tappable, opening the plans sheet. It carries the affordance rather than the hub growing a row,
 * because the hub's rule is that every destination is reachable without a scroll (`more.yaml`
 * asserts exactly that) and a sixth row is how that rule quietly stops holding.
 */
function PlanCard({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: SUBSCRIPTION_KEY,
    queryFn: getSubscription,
  });

  /**
   * Re-ask on every foreground, so the card is never the last screen to hear about a payment.
   *
   * The sheet does its own confirming while it is open, which is the ordinary path. This covers
   * the one that is not: leaving for the provider, dismissing the sheet, and coming back — the
   * app has no global focus refetching (`focusManager` is unwired), so without this the plan card
   * would keep showing the pre-checkout plan until something else happened to invalidate it.
   */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY });
    });
    return () => sub.remove();
  }, [queryClient]);

  // Reserve the same height while loading, so the rows below do not jump under a thumb already
  // travelling towards them.
  if (isLoading) return <Skeleton height={96} />;

  if (isError) {
    return (
      <Card testID="more-plan">
        <Body dim style={{ fontSize: 12.5 }}>Plan</Body>
        <Body>{errorMessage(error)}</Body>
      </Card>
    );
  }

  const { plan, status, detail, tone } = describeSubscription(data);
  const toneColor =
    tone === "danger" ? t.colors.danger : tone === "warn" ? t.colors.warnText : t.colors.text2;

  return (
    <Pressable
      testID="more-plan"
      accessibilityRole="button"
      accessibilityLabel={`Plan ${plan}, ${status}. View plans`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text
            style={{
              fontFamily: t.fonts.mono,
              fontSize: 11,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: t.colors.text3,
            }}
          >
            Plan
          </Text>
          <Text style={{ fontFamily: t.fonts.display, fontSize: 20, color: t.colors.textHi }}>
            {plan}
          </Text>
          <View style={{ flex: 1 }} />
          <Pill label={status} dotColor={toneColor} />
        </View>
        {detail ? <Body style={{ fontSize: 13, color: toneColor }}>{detail}</Body> : null}
        {/* Names the action in words, because a card that happens to be tappable is not an
            affordance — nothing else on this hub is a tappable card. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 13, color: t.colors.textHi }}>
            View plans
          </Text>
          <Ionicons name="chevron-forward" size={14} color={t.colors.text3} />
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * The hub for everything that is not a daily destination.
 *
 * A tab bar holds three to five things well and nothing beyond that, so the fifth slot buys a
 * door rather than a screen: recurring bills, categories, alerts and chat all live behind it and
 * none of them competes with the four screens people open every day.
 *
 * Deliberately a flat list of rows, in one screenful, with no nesting. If this ever needs a
 * scroll to reach the last row it has stopped being a hub and the grouping needs rethinking —
 * `more.yaml` asserts exactly that.
 */
export default function More() {
  const router = useRouter();
  const t = useTheme();
  const { user, signOut } = useAuth();
  const [plansOpen, setPlansOpen] = useState(false);

  // Shared with the tab badge via the same query key, so the count is fetched once.
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const unread = unreadCount(alerts.data);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You will need to sign in again to record expenses.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
    >
      <UpgradeSheet visible={plansOpen} onClose={() => setPlansOpen(false)} />

      {/* First, because "what am I paying for" is the question this hub is opened with, and a
          card below the rows is a card below the fold on a small phone. */}
      <PlanCard onPress={() => setPlansOpen(true)} />

      <Card>
        <ListRow
          testID="more-recurring"
          icon="repeat-outline"
          label="Recurring"
          sub="Bills and subscriptions"
          onPress={() => router.push("/(app)/more/recurring")}
        />
        <Divider />
        <ListRow
          testID="more-categories"
          icon="pricetags-outline"
          label="Categories"
          sub="Rename or remove"
          onPress={() => router.push("/(app)/more/categories")}
        />
        <Divider />
        <ListRow
          testID="more-alerts"
          icon="notifications-outline"
          label="Alerts"
          sub="Budget and bill warnings"
          badge={unread}
          onPress={() => router.push("/(app)/more/alerts")}
        />
        <Divider />
        <ListRow
          testID="more-chat"
          icon="sparkles-outline"
          label="Ask AI"
          sub="Questions about your spending"
          onPress={() => router.push("/(app)/more/chat")}
        />
      </Card>

      <Card>
        <ListRow
          testID="more-settings"
          icon="settings-outline"
          label="Settings"
          sub={user?.email ?? undefined}
          onPress={() => router.push("/(app)/settings")}
        />
        <Divider />
        {/* Confirmed, because signing out on a phone is a fat-finger away from the row above it
            and costs a full re-authentication to undo. */}
        <ListRow
          testID="more-signout"
          icon="log-out-outline"
          label="Sign out"
          destructive
          onPress={confirmSignOut}
        />
      </Card>

      {/* Pricing left this sentence when the plan card grew a way into it. Billing history and the
          admin tools genuinely are still web-only. */}
      <Body dim style={{ fontSize: 12.5 }}>
        Billing history and admin tools live on the web app.
      </Body>
      <View />
    </ScrollView>
  );
}
