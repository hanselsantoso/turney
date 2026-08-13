import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/stores/auth";
import { useTournaments, type Community } from "../../src/api/hooks";
import { Button, Card, Chip, Display } from "../../src/ui";

type Comm = Community & { leaderId: string };

export default function OrganizeHub() {
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const communities = useQuery<Comm[]>({
    queryKey: ["communities", "all"],
    queryFn: () => api("/communities"),
  });
  const tournaments = useTournaments();

  const mine = (communities.data ?? []).filter(
    (c) => c.leaderId === user?.id || user?.isAdmin,
  );
  const myCommIds = new Set(mine.map((c) => c.id));
  const myTournaments = (tournaments.data ?? []).filter((t) => myCommIds.has(t.communityId));

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={myTournaments}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Stack.Screen options={{ title: "Organizer" }} />
          <Display size={24} accentLast>
            RUN YOUR EVENTS
          </Display>
          {mine.length === 0 ? (
            <Card style={{ padding: 16 }}>
              <Text style={styles.dim}>
                You lead no community yet. Create one from your profile, then host tournaments
                here.
              </Text>
            </Card>
          ) : (
            <Button title="+ Create tournament" onPress={() => router.push("/organize/create")} />
          )}
          {myTournaments.length ? <Text style={styles.section}>YOUR TOURNAMENTS</Text> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/organize/manage/${item.id}`)}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Chip
                label={item.status.replace("_", " ").toUpperCase()}
                tone={item.status === "in_progress" ? "live" : item.status === "reg_open" ? "accent" : "dim"}
              />
            </View>
            <Text style={styles.dim}>Tap to manage</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  section: {
    color: tokens.color.textDim,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    marginTop: 6,
  },
  card: { padding: 14, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: tokens.color.text, fontWeight: "700", fontSize: 14.5, flex: 1, marginRight: 8 },
  dim: { color: tokens.color.textDim, fontSize: 12.5 },
});
