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
import { Body, ErrorText } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Ask questions about your own spending.
 *
 * One live thread, held in screen state. `conversationId` arrives with the first reply and is
 * sent on every turn after it, which is what gives the assistant memory. Web additionally offers
 * a drawer of past conversations; that is a laptop affordance, and `GET /chat/conversations` has
 * no response shape in the published contract to render one from in any case.
 *
 * The assistant can *act* — recording an expense, for instance — and says so in `type`. When it
 * does, the caches it touched are invalidated so the other tabs are not left showing stale
 * figures. Nothing here interprets `result` beyond that: the reply text is the backend's to write.
 */
export default function Chat() {
  const t = useTheme();
  const qc = useQueryClient();
  const scroller = useRef<ScrollView>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();

  const ask = useMutation({
    mutationFn: sendChat,
    onSuccess: (res) => {
      setConversationId(res.conversationId ?? conversationId);
      setTurns((prev) => [...prev, { role: "assistant", text: res.message ?? "" }]);
      // The assistant may have written something. Anything it could have changed is refetched
      // rather than guessed at.
      if (res.result) {
        qc.invalidateQueries({ queryKey: ["expenses"] });
        qc.invalidateQueries({ queryKey: ["report", "monthly"] });
        qc.invalidateQueries({ queryKey: ["budgets"] });
      }
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    },
  });

  const send = () => {
    const message = input.trim();
    if (!message || ask.isPending) return;
    setTurns((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    ask.mutate({ conversationId, message });
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  };

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
              “How much did I spend on food this month?” · “What is my biggest category?”
            </Body>
          </View>
        ) : null}

        {turns.map((turn, i) => {
          const mine = turn.role === "user";
          return (
            <View
              key={i}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: mine ? t.colors.cta : t.colors.surface,
                borderColor: mine ? "transparent" : t.colors.border,
                borderWidth: mine ? 0 : 1,
                borderRadius: t.radii.card,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: t.fonts.body,
                  fontSize: 15,
                  color: mine ? t.colors.ctaFg : t.colors.text,
                }}
              >
                {turn.text}
              </Text>
            </View>
          );
        })}

        {ask.isPending ? (
          <Body dim style={{ fontSize: 13 }}>
            Thinking…
          </Body>
        ) : null}
        <ErrorText>{ask.isError ? errorMessage(ask.error) : null}</ErrorText>
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
          disabled={!input.trim() || ask.isPending}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.cta,
            opacity: !input.trim() || ask.isPending ? 0.4 : pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: t.colors.ctaFg, fontFamily: t.fonts.display, fontSize: 17 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
