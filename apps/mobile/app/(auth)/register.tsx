import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../../src/stores/auth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = useAuth((s) => s.register);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await register(email.trim(), password, displayName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: "Create account" }} />
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
          placeholder="10+ characters"
          placeholderTextColor={tokens.color.textDim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Blader name"
          placeholderTextColor={tokens.color.textDim}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Text style={styles.hint}>Shown on brackets and leaderboards</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}
        onPress={onSubmit}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? "Creating" : "Create account"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, gap: 14, backgroundColor: tokens.color.bg },
  field: { gap: 6 },
  label: { color: tokens.color.textDim, fontSize: 12.5, fontWeight: "600" },
  hint: { color: tokens.color.textDim, fontSize: 11.5 },
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
});
