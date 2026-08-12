import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../../src/api/client";
import { Card, Chip } from "../../../src/ui";

type Stage = { id: string; seq: number; name: string; format: string };
type Match = {
  id: string;
  round: number;
  bracketPos: number;
  bracket: string;
  status: string;
  p1RegId: string | null;
  p2RegId: string | null;
  winnerRegId: string | null;
};

export default function JudgeMatches() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const tournament = useQuery<{ name: string; stages: Stage[] }>({
    queryKey: ["tournament", tournamentId],
    queryFn: () => api(`/tournaments/${tournamentId}`),
  });
  const activeStage = tournament.data?.stages?.[0];

  const matches = useQuery<Match[]>({
    queryKey: ["matches", activeStage?.id],
    queryFn: () => api(`/stages/${activeStage!.id}/matches`),
    enabled: !!activeStage,
    refetchInterval: 15000,
  });

  const open = (matches.data ?? []).filter((m) => m.status !== "done");

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={open}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={
        <Text style={styles.head}>
          {tournament.data?.name ?? ""} · {activeStage?.name ?? ""}
        </Text>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {matches.isLoading ? "Loading" : "No open matches. Generate the stage first."}
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/judge/score/${item.id}`)}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>
                R{item.round} · {item.bracket.replace("_", " ")} · #{item.bracketPos}
              </Text>
              <Chip
                label={item.status.replace("_", " ").toUpperCase()}
                tone={item.status === "in_progress" ? "live" : "dim"}
              />
            </View>
            <Text style={styles.meta}>
              {item.p1RegId && item.p2RegId ? "Both players set · tap to score" : "Waiting for players (TBD)"}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  head: { color: tokens.color.text, fontWeight: "800", fontSize: 17, marginBottom: 6 },
  card: { padding: 14, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: tokens.color.text, fontWeight: "700", fontSize: 13.5 },
  meta: { color: tokens.color.textDim, fontSize: 12 },
  empty: { color: tokens.color.textDim, textAlign: "center", marginTop: 60 },
});
