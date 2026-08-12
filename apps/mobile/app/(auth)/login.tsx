import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../../src/stores/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const login = useAuth((s) => s.login);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.wordmark}>
        TURNEY
      </Text>
      <Text style={styles.title}>Sign in</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={tokens.color.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={tokens.color.textDim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}
        onPress={onSubmit}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? "Signing in" : "Sign in"}</Text>
      </Pressable>
      <Link href="/register" style={styles.link}>
        New blader? Create account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 14,
    backgroundColor: tokens.color.bg,
  },
  wordmark: {
    color: tokens.color.accent,
    fontWeight: "800",
    letterSpacing: 4,
    fontSize: 15,
    marginBottom: 4,
  },
  title: { color: tokens.color.text, fontSize: 28, fontWeight: "800", marginBottom: 6 },
  field: { gap: 6 },
  label: { color: tokens.color.textDim, fontSize: 12.5, fontWeight: "600" },
  input: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 14,
    fontSize: 15,
  },
  error: { color: tokens.color.live, fontSize: 12 },
  button: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.md,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  busy: { opacity: 0.6 },
  buttonText: { color: tokens.color.bg, fontWeight: "700", fontSize: 15 },
  link: { color: tokens.color.textDim, textAlign: "center", fontSize: 13, marginTop: 8 },
});
