import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { errorMessage } from "../src/api/client";
import { useAuth } from "../src/context/AuthContext";
import { Body, Button, ErrorText, Field, PageHeader } from "../src/components/ui";
import { useTheme } from "../src/theme/useTheme";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const t = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") await signIn({ email, password });
      else await signUp({ email, password, name });
      router.replace("/(app)");
    } catch (e) {
      setError(errorMessage(e, "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.colors.page }}
    >
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: "Sign in" }} />
        <PageHeader
          title="GastosAI"
          subtitle={mode === "signin" ? "Sign in to track your spending." : "Create an account."}
        />

        {mode === "signup" && (
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        )}
        <Field
          testID="login-email"
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          testID="login-password"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />

        <ErrorText>{error}</ErrorText>
        <Button
          testID="login-submit"
          title={mode === "signin" ? "Sign in" : "Create account"}
          onPress={submit}
          loading={busy}
        />
        <Button
          variant="ghost"
          title={mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          onPress={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        />
        <Body dim style={{ fontSize: 12.5, textAlign: "center" }}>
          Magic-link sign-in is web-only for now.
        </Body>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
