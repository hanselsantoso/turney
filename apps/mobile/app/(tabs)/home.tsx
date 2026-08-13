import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../../src/stores/auth";
import { useCommunities, useTournaments } from "../../src/api/hooks";
import { Banner, Card, Chip, Display, SectionLabel } from "../../src/ui";

const fmtRp = (n: number) => (n > 0 ? `Rp ${n.toLocaleString("id-ID")}` : "Free");

export default function Home() {
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const tournaments = useTournaments();
  const communities = useCommunities();

  const open = (tournaments.data ?? []).filter((t) => t.status === "reg_open");
  const featured = open[0] ?? (tournaments.data ?? [])[0];

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={open.slice(featured ? 1 : 0)}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <View style={styles.hello}>
            <View>
              <Text style={styles.welcome}>Welcome back</Text>
              <Text style={styles.name}>{user?.displayName}</Text>
            </View>
            <Chip label={`ELO ${user?.elo ?? 1000}`} tone="accent" />
          </View>

          {featured ? (
            <Pressable onPress={() => router.push(`/tournament/${featured.id}`)}>
              <Banner>
                <Chip
                  label={featured.status === "reg_open" ? "FEATURED · REG OPEN" : "FEATURED · LIVE"}
                  tone={featured.status === "in_progress" ? "live" : "accent"}
                  glowing={featured.status === "in_progress"}
                />
                <View style={{ minHeight: 44, justifyContent: "flex-end" }}>
                  <Display size={28} accentLast>
                    {featured.name}
                  </Display>
                </View>
                <Text style={styles.bannerMeta}>
                  {new Date(featured.startsAt)
                    .toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })
                    .toUpperCase()}
                  {"  ·  "}
                  {fmtRp(featured.entryFee).toUpperCase()}
                  {"  ·  TAP TO VIEW"}
                </Text>
              </Banner>
            </Pressable>
          ) : (
            <Card style={{ padding: 16 }}>
              <Text style={styles.empty}>
                No tournaments yet. Join a community below, they host the events.
              </Text>
            </Card>
          )}

          <SectionLabel>
            {user?.city ? `Communities near ${user.city}` : "Communities"}
          </SectionLabel>
          {(communities.data ?? []).slice(0, 3).map((c) => (
            <Card key={c.id} style={styles.comCard}>
              <View
                style={[
                  styles.comMark,
                  { backgroundColor: `${c.accentColor ?? tokens.color.accent}26` },
                ]}
              >
                <Text
                  style={{
                    color: c.accentColor ?? tokens.color.accent,
                    fontWeight: "800",
                    fontSize: 16,
                  }}
                >
                  {c.name[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.comName}>{c.name}</Text>
                <Text style={styles.comMeta}>
                  {[c.city, c.region].filter(Boolean).join(", ") || "No location set"}
                </Text>
              </View>
            </Card>
          ))}

          {open.length > (featured ? 1 : 0) ? <SectionLabel>Open tournaments</SectionLabel> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/tournament/${item.id}`)}>
          <Card style={styles.tCard}>
            <View style={styles.tRow}>
              <Text style={styles.tName}>{item.name}</Text>
              <Chip label="REG OPEN" tone="accent" />
            </View>
            <Text style={styles.comMeta}>{fmtRp(item.entryFee)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  hello: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  welcome: { color: tokens.color.textDim, fontSize: 12.5 },
  name: { color: tokens.color.text, fontSize: 26, fontWeight: "800" },
  bannerMeta: {
    color: tokens.color.textDim,
    fontSize: 10.5,
    letterSpacing: 1.2,
    fontVariant: ["tabular-nums"],
  },
  empty: { color: tokens.color.textDim, fontSize: 13.5, lineHeight: 19 },
  comCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  comMark: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  comName: { color: tokens.color.text, fontWeight: "700", fontSize: 14 },
  comMeta: { color: tokens.color.textDim, fontSize: 12 },
  tCard: { padding: 14, gap: 6 },
  tRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tName: { color: tokens.color.text, fontWeight: "700", fontSize: 14.5, flex: 1, marginRight: 8 },
});
