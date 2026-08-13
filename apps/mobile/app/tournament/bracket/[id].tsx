import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../../src/api/client";
import { useTournamentRoom } from "../../../src/realtime";
import { Chip, Display } from "../../../src/ui";

type Participant = { registrationId: string; displayName: string; elo: number };
type Match = {
  id: string;
  round: number;
  bracketPos: number;
  bracket: "winners" | "losers" | "grand_final";
  status: string;
  p1RegId: string | null;
  p2RegId: string | null;
  winnerRegId: string | null;
};
type Stage = { id: string; seq: number; name: string; format: string; status: string };

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useTournamentRoom(id);

  const tournament = useQuery<{ name: string; status: string; stages: Stage[] }>({
    queryKey: ["tournament", id],
    queryFn: () => api(`/tournaments/${id}`),
  });
  const participants = useQuery<Participant[]>({
    queryKey: ["participants", id],
    queryFn: () => api(`/tournaments/${id}/participants`),
  });
  const stage =
    tournament.data?.stages.find((s) => s.status === "active") ?? tournament.data?.stages[0];
  const matches = useQuery<Match[]>({
    queryKey: ["matches", stage?.id],
    queryFn: () => api(`/stages/${stage!.id}/matches`),
    enabled: !!stage,
    refetchInterval: 12000,
  });

  const nameOf = (regId: string | null) => {
    if (!regId) return "TBD";
    return participants.data?.find((p) => p.registrationId === regId)?.displayName ?? "?";
  };

  const winners = (matches.data ?? []).filter((m) => m.bracket === "winners");
  const losers = (matches.data ?? []).filter((m) => m.bracket === "losers");
  const gf = (matches.data ?? []).filter((m) => m.bracket === "grand_final");
  const roundsOf = (ms: Match[]) => {
    const map = new Map<number, Match[]>();
    for (const m of ms) {
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  };

  function Cell({ m }: { m: Match }) {
    const live = m.status === "in_progress";
    return (
      <View style={[styles.cell, live && styles.cellLive]}>
        {([m.p1RegId, m.p2RegId] as const).map((rid, i) => {
          const won = m.winnerRegId != null && m.winnerRegId === rid;
          const lost = m.winnerRegId != null && rid != null && m.winnerRegId !== rid;
          return (
            <View key={i} style={[styles.cellRow, i === 1 && styles.cellRowDivider]}>
              <View style={[styles.winBar, won && { backgroundColor: tokens.color.win }]} />
              <Text
                style={[styles.cellName, lost && { color: tokens.color.textDim }]}
                numberOfLines={1}
              >
                {nameOf(rid)}
              </Text>
              {won ? <Text style={styles.w}>W</Text> : null}
            </View>
          );
        })}
        {live ? (
          <View style={styles.liveTag}>
            <Chip label="LIVE" tone="live" glowing />
          </View>
        ) : null}
      </View>
    );
  }

  function BracketColumns({ ms, prefix }: { ms: Match[]; prefix: string }) {
    return (
      <>
        {roundsOf(ms).map(([round, list]) => (
          <View key={`${prefix}${round}`} style={styles.col}>
            <Text style={styles.colHead}>
              {prefix} R{round}
            </Text>
            <View style={{ gap: 12, justifyContent: "space-around", flex: 1 }}>
              {list
                .sort((a, b) => a.bracketPos - b.bracketPos)
                .map((m) => (
                  <Cell key={m.id} m={m} />
                ))}
            </View>
          </View>
        ))}
      </>
    );
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: "Bracket" }} />
      <View style={styles.head}>
        <Display size={22} accentLast>
          {tournament.data?.name ?? ""}
        </Display>
        <Text style={styles.sub}>
          {stage ? `${stage.name.toUpperCase()} · ${stage.format.replace("_", " ").toUpperCase()}` : ""}
        </Text>
      </View>
      {(matches.data ?? []).length === 0 ? (
        <Text style={styles.empty}>
          {matches.isLoading ? "Loading bracket" : "Bracket not generated yet."}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.board}>
          <BracketColumns ms={winners} prefix="W" />
          {losers.length ? <BracketColumns ms={losers} prefix="L" /> : null}
          {gf.length ? <BracketColumns ms={gf} prefix="GF" /> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  head: { padding: 16, paddingBottom: 8, gap: 4 },
  sub: {
    color: tokens.color.textDim,
    fontSize: 10.5,
    letterSpacing: 1.4,
    fontVariant: ["tabular-nums"],
  },
  board: { padding: 16, gap: 18 },
  col: { width: 172 },
  colHead: {
    color: tokens.color.textDim,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  cell: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    overflow: "hidden",
  },
  cellLive: { borderColor: `${tokens.color.live}aa` },
  cellRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingRight: 10 },
  cellRowDivider: { borderTopWidth: 1, borderTopColor: tokens.color.surface2 },
  winBar: { width: 3, alignSelf: "stretch", marginRight: 9 },
  cellName: { color: tokens.color.text, fontSize: 12.5, fontWeight: "600", flex: 1 },
  w: { color: tokens.color.win, fontWeight: "800", fontSize: 11 },
  liveTag: { position: "absolute", top: -9, right: 8 },
  empty: { color: tokens.color.textDim, textAlign: "center", marginTop: 60 },
});
