import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../../src/api/client";
import { useAuth } from "../../../src/stores/auth";
import { useTournamentRoom } from "../../../src/realtime";
import { Banner, Button, Card, Chip, SectionLabel } from "../../../src/ui";

type Participant = { registrationId: string; userId: string; displayName: string; elo: number };
type Match = {
  id: string;
  round: number;
  bracket: string;
  status: string;
  p1RegId: string | null;
  p2RegId: string | null;
  winnerRegId: string | null;
  stadiumId: string | null;
};
type Stadium = { id: string; name: string };
type Stage = { id: string; seq: number; name: string; status: string; format: string };

export default function TournamentDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  useTournamentRoom(id);

  const tournament = useQuery<{ name: string; status: string; stages: Stage[] }>({
    queryKey: ["tournament", id],
    queryFn: () => api(`/tournaments/${id}`),
  });
  const participants = useQuery<Participant[]>({
    queryKey: ["participants", id],
    queryFn: () => api(`/tournaments/${id}/participants`),
  });
  const stadiums = useQuery<Stadium[]>({
    queryKey: ["stadiums", id],
    queryFn: () => api(`/tournaments/${id}/stadiums`),
  });
  const stage =
    tournament.data?.stages.find((s) => s.status === "active") ?? tournament.data?.stages[0];
  const matches = useQuery<Match[]>({
    queryKey: ["matches", stage?.id],
    queryFn: () => api(`/stages/${stage!.id}/matches`),
    enabled: !!stage,
    refetchInterval: 10000,
  });

  const myReg = participants.data?.find((p) => p.userId === user?.id);
  const mine = (matches.data ?? []).filter(
    (m) => m.p1RegId === myReg?.registrationId || m.p2RegId === myReg?.registrationId,
  );
  const next =
    mine.find((m) => m.status === "in_progress") ?? mine.find((m) => m.status !== "done");
  const nameOf = (rid: string | null) =>
    participants.data?.find((p) => p.registrationId === rid)?.displayName ?? "TBD";
  const eloOf = (rid: string | null) =>
    participants.data?.find((p) => p.registrationId === rid)?.elo;
  const arenaOf = (sid: string | null) =>
    stadiums.data?.find((s) => s.id === sid)?.name ?? "Arena TBD";
  const oppOf = (m: Match) =>
    m.p1RegId === myReg?.registrationId ? m.p2RegId : m.p1RegId;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "My tournament" }} />
      {next ? (
        <Banner>
          <Text style={styles.roundLb}>
            {stage?.name.toUpperCase()} · ROUND {next.round}
            {next.status === "in_progress" ? " · LIVE" : ""}
          </Text>
          <Text style={styles.arena}>{arenaOf(next.stadiumId).toUpperCase()}</Text>
          <Text style={styles.vs}>
            vs <Text style={{ fontWeight: "800", color: tokens.color.text }}>{nameOf(oppOf(next))}</Text>
            {eloOf(oppOf(next)) ? (
              <Text style={styles.vsElo}> · {eloOf(oppOf(next))}</Text>
            ) : null}
          </Text>
        </Banner>
      ) : (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: tokens.color.textDim, fontSize: 13.5 }}>
            {mine.length === 0
              ? "No matches yet. Bracket drops when the organizer generates the stage."
              : "All your matches are done. Watch the bracket for results."}
          </Text>
        </Card>
      )}

      <SectionLabel>Your matches</SectionLabel>
      <Card>
        {mine.map((m) => {
          const won = m.winnerRegId != null && m.winnerRegId === myReg?.registrationId;
          const lost = m.winnerRegId != null && !won;
          return (
            <View key={m.id} style={styles.row}>
              <Text style={styles.rd}>R{m.round}</Text>
              <Text style={styles.opp} numberOfLines={1}>
                vs {nameOf(oppOf(m))} · {arenaOf(m.stadiumId)}
              </Text>
              <Chip
                label={won ? "WIN" : lost ? "LOSS" : m.status === "in_progress" ? "LIVE" : "UPCOMING"}
                tone={won ? "win" : lost ? "live" : m.status === "in_progress" ? "live" : "dim"}
                glowing={m.status === "in_progress"}
              />
            </View>
          );
        })}
        {mine.length === 0 ? <Text style={styles.emptyRow}>Nothing scheduled yet</Text> : null}
      </Card>

      <Button title="View full bracket" kind="secondary" onPress={() => router.push(`/tournament/bracket/${id}`)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  roundLb: {
    color: tokens.color.accent,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  arena: {
    color: tokens.color.accent,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  vs: { color: tokens.color.textDim, fontSize: 14 },
  vsElo: { color: tokens.color.textDim, fontVariant: ["tabular-nums"] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
  },
  rd: { color: tokens.color.textDim, width: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  opp: { color: tokens.color.text, flex: 1, fontSize: 13 },
  emptyRow: { color: tokens.color.textDim, padding: 14, fontSize: 13 },
});
