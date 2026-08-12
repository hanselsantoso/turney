import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../../src/api/client";
import { useAuth } from "../../../src/stores/auth";
import { Button, Card } from "../../../src/ui";

type Match = { id: string; p1RegId: string; p2RegId: string; status: string };
type Battle = { id: string; seq: number; winnerRegId: string; finishType: string; points: number };

const FINISHES = [
  { key: "xtreme", label: "XTREME FINISH", pts: 3 },
  { key: "burst", label: "BURST FINISH", pts: 2 },
  { key: "over", label: "OVER FINISH", pts: 2 },
  { key: "spin", label: "SPIN FINISH", pts: 1 },
] as const;

export default function JudgeScore() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const token = useAuth((s) => s.accessToken);
  const qc = useQueryClient();
  const router = useRouter();
  const [selected, setSelected] = useState<"p1" | "p2">("p1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* match fetched via its stage list is overkill here; battles endpoint carries state */
  const battles = useQuery<Battle[]>({
    queryKey: ["battles", matchId],
    queryFn: () => api(`/matches/${matchId}/battles`),
    refetchInterval: 10000,
  });

  /* we need reg ids; stash them from the first battle post or match GET via stage.
     Pragmatic MVP: fetch the match by scanning its stage is not available, so we
     read reg ids from route state passed by the list screen in a future pass.
     For now, resolve via dedicated endpoint. */
  const match = useQuery<Match>({
    queryKey: ["match", matchId],
    queryFn: () => api(`/matches/${matchId}`),
  });

  const p1 = match.data?.p1RegId;
  const p2 = match.data?.p2RegId;
  const score = { p1: 0, p2: 0 };
  for (const b of battles.data ?? []) {
    if (b.winnerRegId === p1) score.p1 += b.points;
    if (b.winnerRegId === p2) score.p2 += b.points;
  }
  const canFinalize = Math.max(score.p1, score.p2) >= 4 && score.p1 !== score.p2;

  async function record(finish: (typeof FINISHES)[number]) {
    if (!p1 || !p2) return;
    setError(null);
    setBusy(true);
    try {
      await api(
        `/matches/${matchId}/battles`,
        {
          method: "POST",
          body: JSON.stringify({
            winnerRegId: selected === "p1" ? p1 : p2,
            finishType: finish.key,
          }),
        },
        token,
      );
      qc.invalidateQueries({ queryKey: ["battles", matchId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setError(null);
    setBusy(true);
    try {
      await api(`/matches/${matchId}/finalize`, { method: "POST" }, token);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Score match" }} />
      <View style={styles.cols}>
        {(["p1", "p2"] as const).map((side) => (
          <Pressable
            key={side}
            style={[styles.col, selected === side && styles.colSel]}
            onPress={() => setSelected(side)}
          >
            <Text style={styles.colName}>{side === "p1" ? "Player 1" : "Player 2"}</Text>
            <Text style={styles.colScore}>{score[side]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Tap a player, then the finish · first to 4</Text>

      {FINISHES.map((f) => (
        <Pressable
          key={f.key}
          disabled={busy || !p1 || !p2}
          onPress={() => record(f)}
          style={({ pressed }) => [styles.fbtn, pressed && styles.fbtnPressed]}
        >
          <Text style={styles.fbtnText}>{f.label}</Text>
          <Text style={styles.fbtnPts}>+{f.pts}</Text>
        </Pressable>
      ))}

      <Card>
        {(battles.data ?? [])
          .slice(-4)
          .reverse()
          .map((b) => (
            <Text key={b.id} style={styles.hist}>
              B{b.seq} · {b.finishType.toUpperCase()} +{b.points} ·{" "}
              {b.winnerRegId === p1 ? "Player 1" : "Player 2"}
            </Text>
          ))}
        {(battles.data ?? []).length === 0 ? (
          <Text style={styles.hist}>No battles yet</Text>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={busy ? "Working" : "Finalize winner"}
        onPress={finalize}
        disabled={!canFinalize || busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  cols: { flexDirection: "row", gap: 10 },
  col: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 14,
    alignItems: "center",
  },
  colSel: { borderColor: tokens.color.accent, backgroundColor: `${tokens.color.accent}14` },
  colName: { color: tokens.color.text, fontWeight: "700", fontSize: 13.5 },
  colScore: {
    color: tokens.color.text,
    fontWeight: "800",
    fontSize: 42,
    fontVariant: ["tabular-nums"],
  },
  hint: { color: tokens.color.textDim, fontSize: 11.5, textAlign: "center" },
  fbtn: {
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fbtnPressed: { borderColor: tokens.color.accent, backgroundColor: `${tokens.color.accent}22` },
  fbtnText: { color: tokens.color.text, fontWeight: "800", fontSize: 15 },
  fbtnPts: { color: tokens.color.accent, fontWeight: "800", fontVariant: ["tabular-nums"] },
  hist: {
    color: tokens.color.textDim,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontVariant: ["tabular-nums"],
  },
  error: { color: tokens.color.live, fontSize: 12.5, textAlign: "center" },
});
