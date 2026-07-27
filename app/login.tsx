import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { errorMessage } from "../src/api/client";
import { useAuth } from "../src/context/AuthContext";
import { Button, ErrorText, Field, Screen, colors } from "../src/components/ui";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
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
      router.replace("/(app)/dashboard");
    } catch (e) {
      setError(errorMessage(e, "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <Screen>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700" }}>GastosAI</Text>
        <Text style={{ color: colors.muted }}>
          {mode === "signin" ? "Sign in to track your spending." : "Create an account."}
        </Text>

        {mode === "signup" && (
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />

        <ErrorText>{error}</ErrorText>
        <Button title={mode === "signin" ? "Sign in" : "Create account"} onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          title={mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          onPress={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
