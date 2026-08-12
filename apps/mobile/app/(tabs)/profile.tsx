import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../../src/stores/auth";
import { usePlayerStats } from "../../src/api/hooks";
import { Button, Card, Chip, SectionLabel } from "../../src/ui";

export default function Profile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const stats = usePlayerStats(user?.id);
  const router = useRouter();

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.displayName?.[0] ?? "?"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.displayName}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Chip label={user?.playerCode ?? ""} tone="accent" />
            {user?.isAdmin ? <Chip label="ADMIN" tone="live" /> : null}
          </View>
        </View>
        <Text style={styles.elo}>{stats.data?.elo ?? user?.elo ?? 1000}</Text>
      </View>

      <View style={styles.statGrid}>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>MATCHES</Text>
          <Text style={styles.statValue}>{stats.data?.matches ?? 0}</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>WINS</Text>
          <Text style={styles.statValue}>{stats.data?.wins ?? 0}</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>WIN RATE</Text>
          <Text style={styles.statValue}>{stats.data?.winRate ?? 0}%</Text>
        </Card>
      </View>

      <SectionLabel>Recent ELO changes</SectionLabel>
      <Card>
        {(stats.data?.history ?? []).slice(0, 8).map((h, i) => (
          <View key={i} style={styles.histRow}>
            <Text
              style={[
                styles.delta,
                { color: h.delta > 0 ? tokens.color.win : tokens.color.live },
              ]}
            >
              {h.delta > 0 ? `+${h.delta}` : h.delta}
            </Text>
            <Text style={styles.histAfter}>→ {h.eloAfter}</Text>
            <Text style={styles.histDate}>
              {new Date(h.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        ))}
        {(stats.data?.history ?? []).length === 0 ? (
          <Text style={styles.empty}>No matches yet. Enter a tournament.</Text>
        ) : null}
      </Card>

      <Button
        title="Judge tools · scan player QR"
        kind="secondary"
        onPress={() => router.push("/judge/scan")}
      />
      <Button title="Sign out" kind="secondary" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: tokens.color.accent, fontWeight: "800", fontSize: 20 },
  name: { color: tokens.color.text, fontSize: 22, fontWeight: "800" },
  elo: {
    color: tokens.color.text,
    fontSize: 26,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statGrid: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12 },
  statLabel: { color: tokens.color.textDim, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  statValue: {
    color: tokens.color.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
  },
  delta: { fontWeight: "800", fontSize: 14, width: 44, fontVariant: ["tabular-nums"] },
  histAfter: { color: tokens.color.text, flex: 1, fontVariant: ["tabular-nums"] },
  histDate: { color: tokens.color.textDim, fontSize: 11.5 },
  empty: { color: tokens.color.textDim, padding: 14, fontSize: 13 },
});
