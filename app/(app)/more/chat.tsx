import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { errorMessage } from "../../../src/api/client";
import { sendChat } from "../../../src/api/chat";
import type { ChatResponse } from "../../../src/api/types";
import PreviewCard from "../../../src/components/chat/PreviewCard";
import type { ActionPreview } from "../../../src/components/chat/PreviewCard";
import ResultView from "../../../src/components/chat/ResultView";
import { affectedQueryKeys, buildConfirmMessage } from "../../../src/components/chat/chatActions";
import { Body, ErrorText } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** `action` | `preview` | `disambiguate`, straight from the backend. */
  type?: string;
  result?: unknown;
  preview?: ActionPreview;
  previewConfirmed?: boolean;
}

/**
 * Ask questions about your own spending, and let the assistant act on them.
 *
 * A reply is not just prose. The backend answers with a `type` and a `result`, and this screen used
 * to render only `message` — so a question like "how much do I spend on food" showed its caption
 * ("Category totals for 2026-07.") and dropped the six rows underneath it, and a request to *add*
 * an expense rendered the proposal as text while the write never happened.
 *
 * The three types the backend uses:
 *   - `action`      — done; `result` carries the data (see `ResultView`)
 *   - `preview`     — proposes a write and waits for confirmation (see `PreviewCard`)
 *   - `disambiguate`— "which one did you mean", rendered as a list of choices
 *
 * One live thread, held in screen state. `conversationId` arrives with the first reply and is sent
 * on every turn after it, which is what gives the assistant memory. Web additionally offers a
 * drawer of past conversations; that is a laptop affordance, and `GET /chat/conversations` has no
 * response shape in the published contract to render one from in any case.
 */
export default function Chat() {
  const t = useTheme();
  const qc = useQueryClient();
  const scroller = useRef<ScrollView>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();

  const scrollToEnd = () =>
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));

  /** Anything the assistant just did could have changed what other screens are showing. */
  const invalidateFor = (toolName?: string) => {
    for (const key of affectedQueryKeys(toolName ?? "")) {
      qc.invalidateQueries({ queryKey: key });
    }
  };

  const appendReply = (res: ChatResponse) => {
    setConversationId(res.conversationId ?? conversationId);

    const preview =
      res.type === "preview" && res.result && typeof res.result === "object"
        ? (res.result as ActionPreview)
        : undefined;

    setTurns((prev) => [
      ...prev,
      {
        role: "assistant",
        text: res.message ?? "",
        type: res.type,
        result: res.type === "preview" ? undefined : res.result,
        preview,
      },
    ]);

    // A completed action has already written; a preview has not, so nothing is stale yet.
    if (res.type === "action") invalidateFor(preview?.toolName);
    scrollToEnd();
  };

  const ask = useMutation({ mutationFn: sendChat, onSuccess: appendReply });

  const confirm = useMutation({
    mutationFn: sendChat,
    onSuccess: (res) => {
      // Mark the proposal as handled so its buttons cannot fire twice.
      setTurns((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].preview && !next[i].previewConfirmed) {
            next[i] = { ...next[i], previewConfirmed: true };
            break;
          }
        }
        return next;
      });
      appendReply(res);
      invalidateFor(undefined);
    },
  });

  const send = () => {
    const message = input.trim();
    if (!message || ask.isPending) return;
    setTurns((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    ask.mutate({ conversationId, message });
    scrollToEnd();
  };

  const confirmPreview = (preview: ActionPreview) => {
    const message = buildConfirmMessage(preview.toolName, preview.params);
    if (!message) {
      // No phrasing for this tool. Sending an empty message would be a confusing no-op, so say so.
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "This action can't be confirmed from the phone yet. Try it on the web app.",
        },
      ]);
      return;
    }
    confirm.mutate({ conversationId, message, mode: "execute" });
  };

  const cancelPreview = () => {
    setTurns((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].preview && !next[i].previewConfirmed) {
          next[i] = { ...next[i], preview: undefined, text: "Cancelled." };
          break;
        }
      }
      return next;
    });
  };

  const pending = ask.isPending || confirm.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
      style={{ flex: 1, backgroundColor: t.colors.page }}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: t.spacing.screen, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 ? (
          <View style={{ gap: 6, paddingTop: 8 }}>
            <Body>Ask about your spending.</Body>
            <Body dim style={{ fontSize: 13 }}>
              “How much did I spend on food this month?” · “Add lunch 150” · “What is my biggest
              category?”
            </Body>
          </View>
        ) : null}

        {turns.map((turn, i) => {
          const mine = turn.role === "user";
          return (
            <View
              key={i}
              // A user bubble hugs its text and is capped; an assistant reply stretches.
              //
              // Not cosmetic: a percentage maxWidth on a wrapper whose own width comes from its
              // content measures circularly, and the result table rendered *outside* its own
              // rounded background with the next message overlapping it. Assistant replies are
              // tabular and want the full width regardless.
              style={
                mine
                  ? { alignSelf: "flex-end", maxWidth: "85%", gap: 8 }
                  : { alignSelf: "stretch", gap: 8 }
              }
            >
              <View
                style={{
                  backgroundColor: mine ? t.colors.cta : t.colors.surface,
                  borderColor: mine ? "transparent" : t.colors.border,
                  borderWidth: mine ? 0 : 1,
                  borderRadius: t.radii.card,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                {turn.text ? (
                  <Text
                    style={{
                      fontFamily: t.fonts.body,
                      fontSize: 15,
                      color: mine ? t.colors.ctaFg : t.colors.text,
                    }}
                  >
                    {turn.text}
                  </Text>
                ) : null}

                {/* The data the caption refers to. Without this the reply is a label for nothing. */}
                {!mine && turn.result !== undefined ? <ResultView result={turn.result} /> : null}
              </View>

              {turn.preview ? (
                <PreviewCard
                  preview={turn.preview}
                  confirmed={!!turn.previewConfirmed}
                  pending={confirm.isPending}
                  onConfirm={() => confirmPreview(turn.preview as ActionPreview)}
                  onCancel={cancelPreview}
                />
              ) : null}
            </View>
          );
        })}

        {pending ? (
          <Body dim style={{ fontSize: 13 }}>
            Thinking…
          </Body>
        ) : null}
        <ErrorText>
          {ask.isError
            ? errorMessage(ask.error)
            : confirm.isError
              ? errorMessage(confirm.error)
              : null}
        </ErrorText>
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
          padding: t.spacing.screen,
          borderTopColor: t.colors.border,
          borderTopWidth: 1,
          backgroundColor: t.colors.page,
        }}
      >
        <TextInput
          testID="chat-input"
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question"
          placeholderTextColor={t.colors.text3}
          multiline
          style={{
            flex: 1,
            maxHeight: 120,
            backgroundColor: t.colors.inputBg,
            borderColor: t.colors.borderInput,
            borderWidth: 1,
            borderRadius: t.radii.input,
            color: t.colors.textHi,
            fontFamily: t.fonts.body,
            fontSize: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        />
        <Pressable
          testID="chat-send"
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={send}
          disabled={!input.trim() || pending}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.cta,
            opacity: !input.trim() || pending ? 0.4 : pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: t.colors.ctaFg, fontFamily: t.fonts.display, fontSize: 17 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
