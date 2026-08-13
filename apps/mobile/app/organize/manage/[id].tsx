import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../../src/api/client";
import { useAuth } from "../../../src/stores/auth";
import { Banner, Button, Card, Chip, Display, SectionLabel } from "../../../src/ui";

type Stage = { id: string; seq: number; name: string; format: string; status: string };
type Tournament = { id: string; name: string; status: string; entryFee: number; stages: Stage[] };
type Participant = {
  registrationId: string;
  displayName: string;
  playerCode: string;
  elo: number;
  status: string;
};

const NEXT: Record<string, Array<{ to: string; label: string; danger?: boolean }>> = {
  draft: [{ to: "reg_open", label: "Open registration" }],
  reg_open: [{ to: "reg_closed", label: "Close registration", danger: true }],
  reg_closed: [
    { to: "check_in", label: "Start check-in" },
    { to: "in_progress", label: "Start tournament (skip check-in)" },
  ],
  check_in: [{ to: "in_progress", label: "Start tournament" }],
  in_progress: [{ to: "completed", label: "Complete tournament", danger: true }],
  completed: [],
};

export default function ManageTournament() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuth((s) => s.accessToken);
  const qc = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [cash, setCash] = useState("");

  const t = useQuery<Tournament>({
    queryKey: ["tournament", id],
    queryFn: () => api(`/tournaments/${id}`),
  });
  const participants = useQuery<Participant[]>({
    queryKey: ["participants", id],
    queryFn: () => api(`/tournaments/${id}/participants`),
  });

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      qc.invalidateQueries({ queryKey: ["participants", id] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (to: string) =>
    act(() => api(`/tournaments/${id}/status`, { method: "POST", body: JSON.stringify({ to }) }, token));

  const onspot = () =>
    act(async () => {
      await api(
        `/tournaments/${id}/onspot`,
        {
          method: "POST",
          body: JSON.stringify({
            playerCode: code.trim().toUpperCase(),
            cashAmount: cash ? Number(cash) : undefined,
          }),
        },
        token,
      );
      setCode("");
      setCash("");
    });

  const generate = (stageId: string) =>
    act(async () => {
      await api(`/stages/${stageId}/generate`, { method: "POST" }, token);
      qc.invalidateQueries({ queryKey: ["matches", stageId] });
    });

  const [advanceResult, setAdvanceResult] = useState<string | null>(null);
  const advance = (stageId: string) =>
    act(async () => {
      const r = await api(`/stages/${stageId}/advance`, { method: "POST" }, token);
      setAdvanceResult(
        r.stage === "final"
          ? `CHAMPION: ${r.champion?.displayName ?? "?"} 🏆`
          : `Advanced ${r.advancers.length} players to next stage`,
      );
      qc.invalidateQueries({ queryKey: ["matches"] });
    });

  const pairNext = (stageId: string) =>
    act(async () => {
      await api(`/stages/${stageId}/pair-next`, { method: "POST" }, token);
      qc.invalidateQueries({ queryKey: ["matches", stageId] });
    });

  const addArena = () =>
    act(() =>
      api(
        `/tournaments/${id}/stadiums`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `Arena ${(stadiumCount ?? 0) + 1}`,
          }),
        },
        token,
      ),
    );

  const stadiums = useQuery<Array<{ id: string }>>({
    queryKey: ["stadiums", id],
    queryFn: () => api(`/tournaments/${id}/stadiums`),
  });
  const stadiumCount = stadiums.data?.length;

  if (!t.data) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Manage" }} />
        <Text style={{ color: tokens.color.textDim }}>Loading</Text>
      </View>
    );
  }

  const status = t.data.status;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Manage" }} />
      <Banner>
        <Chip
          label={status.replace("_", " ").toUpperCase()}
          tone={status === "in_progress" ? "live" : status === "reg_open" ? "accent" : "dim"}
          glowing={status === "in_progress"}
        />
        <Display size={24} accentLast>
          {t.data.name}
        </Display>
        <Text style={styles.dim}>
          {participants.data?.length ?? 0} registered · {stadiumCount ?? 0} arenas
        </Text>
      </Banner>

      <SectionLabel>Status controls</SectionLabel>
      <View style={{ gap: 8 }}>
        {(NEXT[status] ?? []).map((n) => (
          <Button
            key={n.to}
            title={n.label}
            kind={n.danger ? "danger" : "primary"}
            onPress={() => setStatus(n.to)}
            disabled={busy}
          />
        ))}
        {status === "completed" ? (
          <Text style={styles.dim}>Tournament complete. Nothing left to do.</Text>
        ) : null}
      </View>

      {status === "reg_open" ? (
        <>
          <SectionLabel>On-spot registration · by player code</SectionLabel>
          <Card style={{ padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Player code e.g. REN-7203"
                placeholderTextColor={tokens.color.textDim}
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
              />
              <TextInput
                style={[styles.input, { width: 110 }]}
                placeholder="Cash Rp"
                placeholderTextColor={tokens.color.textDim}
                keyboardType="number-pad"
                value={cash}
                onChangeText={setCash}
              />
            </View>
            <Button
              title={cash ? "Add + record cash" : "Add (payment pending)"}
              onPress={onspot}
              disabled={busy || code.trim().length < 4}
            />
          </Card>
        </>
      ) : null}

      {status === "in_progress" || status === "check_in" ? (
        <>
          <SectionLabel>Stages</SectionLabel>
          {(t.data.stages ?? []).map((s) => (
            <Card key={s.id} style={{ padding: 12, gap: 8 }}>
              <View style={styles.row}>
                <Text style={styles.stageName}>
                  {s.seq}. {s.name} · {s.format.replace("_", " ").toUpperCase()}
                </Text>
                <Chip
                  label={s.status.toUpperCase()}
                  tone={s.status === "active" ? "accent" : s.status === "done" ? "win" : "dim"}
                />
              </View>
              {s.status === "pending" ? (
                <Button
                  title="Generate matches (ELO seeded)"
                  onPress={() => generate(s.id)}
                  disabled={busy}
                />
              ) : s.status === "active" ? (
                <>
                  <Button
                    title="View bracket"
                    kind="secondary"
                    onPress={() => router.push(`/tournament/bracket/${id}`)}
                  />
                  {s.format === "swiss" ? (
                    <Button
                      title="Pair next round"
                      kind="secondary"
                      onPress={() => pairNext(s.id)}
                      disabled={busy}
                    />
                  ) : null}
                  <Button
                    title="Advance stage (close + seed next)"
                    kind="danger"
                    onPress={() => advance(s.id)}
                    disabled={busy}
                  />
                </>
              ) : (
                <Button
                  title="View bracket"
                  kind="secondary"
                  onPress={() => router.push(`/tournament/bracket/${id}`)}
                />
              )}
            </Card>
          ))}
          <Button title={`+ Add arena (${stadiumCount ?? 0})`} kind="secondary" onPress={addArena} disabled={busy} />
        </>
      ) : null}

      <SectionLabel>{`Participants · ${participants.data?.length ?? 0}`}</SectionLabel>
      <Card>
        {(participants.data ?? []).map((p) => (
          <View key={p.registrationId} style={styles.pRow}>
            <Text style={styles.pName} numberOfLines={1}>
              {p.displayName}
            </Text>
            <Text style={styles.pCode}>{p.playerCode}</Text>
            <Chip
              label={p.status.replace("_", " ").toUpperCase()}
              tone={p.status === "checked_in" || p.status === "paid" ? "win" : p.status === "cancelled" ? "live" : "amber"}
            />
          </View>
        ))}
        {(participants.data ?? []).length === 0 ? (
          <Text style={[styles.dim, { padding: 14 }]}>No one registered yet</Text>
        ) : null}
      </Card>

      {advanceResult ? (
        <Card style={{ padding: 14 }}>
          <Text style={{ color: tokens.color.win, fontWeight: "800", textAlign: "center" }}>
            {advanceResult}
          </Text>
        </Card>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  dim: { color: tokens.color.textDim, fontSize: 12.5 },
  input: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 12,
    fontSize: 13.5,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stageName: { color: tokens.color.text, fontWeight: "700", fontSize: 13, flex: 1, marginRight: 8 },
  pRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
  },
  pName: { color: tokens.color.text, fontWeight: "600", flex: 1, fontSize: 13.5 },
  pCode: { color: tokens.color.textDim, fontSize: 11.5, fontVariant: ["tabular-nums"] },
  error: { color: tokens.color.live, fontSize: 12.5, textAlign: "center" },
});
