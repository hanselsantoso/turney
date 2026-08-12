import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../src/stores/auth";

export default function Home() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: "Turney" }} />
      <Text style={styles.welcome}>Welcome back</Text>
      <Text style={styles.name}>{user?.displayName}</Text>
      <View style={styles.row}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>ELO {user?.elo}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{user?.playerCode}</Text>
        </View>
        {user?.isAdmin ? (
          <View style={[styles.chip, styles.adminChip]}>
            <Text style={[styles.chipText, styles.adminText]}>ADMIN</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.placeholder}>
        Tournaments, communities, and decks land here in Phase 2.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }] }]}
        onPress={logout}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 10, backgroundColor: tokens.color.bg },
  welcome: { color: tokens.color.textDim, fontSize: 13, marginTop: 8 },
  name: { color: tokens.color.text, fontSize: 30, fontWeight: "800" },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
  chip: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { color: tokens.color.textDim, fontSize: 12, fontWeight: "700" },
  adminChip: { borderColor: tokens.color.accent },
  adminText: { color: tokens.color.accent },
  placeholder: { color: tokens.color.textDim, fontSize: 13.5, marginTop: 18, lineHeight: 20 },
  button: {
    marginTop: "auto",
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    padding: 15,
    alignItems: "center",
  },
  buttonText: { color: tokens.color.text, fontWeight: "700" },
});
