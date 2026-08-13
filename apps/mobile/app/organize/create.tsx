import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tokens, type StageFormat, type StageScoring } from "@turney/shared";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/stores/auth";
import { Button, Card, SectionLabel } from "../../src/ui";

type Comm = { id: string; name: string; leaderId: string };
type StageDraft = {
  name: string;
  format: StageFormat;
  scoring: StageScoring;
  advanceCount?: number;
};

const FORMATS: Array<{ key: StageFormat; label: string }> = [
  { key: "round_robin", label: "ROUND ROBIN" },
  { key: "swiss", label: "SWISS" },
  { key: "single_elim", label: "SINGLE ELIM" },
  { key: "double_elim", label: "DOUBLE ELIM" },
];

export default function CreateTournament() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.accessToken);
  const router = useRouter();
  const qc = useQueryClient();

  const communities = useQuery<Comm[]>({
    queryKey: ["communities", "all"],
    queryFn: () => api("/communities"),
  });
  const mine = (communities.data ?? []).filter(
    (c) => c.leaderId === user?.id || user?.isAdmin,
  );

  const [communityId, setCommunityId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("50000");
  const [maxP, setMaxP] = useState("32");
  const [daysAhead, setDaysAhead] = useState("7");
  const [stages, setStages] = useState<StageDraft[]>([
    { name: "Stage 1", format: "round_robin", scoring: "points_accum", advanceCount: 2 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosenCommunity = communityId ?? mine[0]?.id ?? null;

  function patchStage(i: number, patch: Partial<StageDraft>) {
    setStages((s) => s.map((st, k) => (k === i ? { ...st, ...patch } : st)));
  }

  async function submit() {
    setError(null);
    if (!chosenCommunity) return setError("Pick a community");
    if (name.trim().length < 3) return setError("Name too short");
    setBusy(true);
    try {
      const t = await api(
        "/tournaments",
        {
          method: "POST",
          body: JSON.stringify({
            communityId: chosenCommunity,
            name: name.trim(),
            maxParticipants: Number(maxP) || 32,
            entryFee: Number(fee) || 0,
            startsAt: new Date(Date.now() + (Number(daysAhead) || 7) * 864e5).toISOString(),
            stages: stages.map((s, i) => ({ ...s, name: s.name || `Stage ${i + 1}` })),
          }),
        },
        token,
      );
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      router.replace(`/organize/manage/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Create tournament" }} />

      <SectionLabel>Community</SectionLabel>
      <View style={styles.pills}>
        {mine.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.pill, chosenCommunity === c.id && styles.pillOn]}
            onPress={() => setCommunityId(c.id)}
          >
            <Text style={[styles.pillText, chosenCommunity === c.id && styles.pillTextOn]}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>Basics</SectionLabel>
      <TextInput
        style={styles.input}
        placeholder="Tournament name"
        placeholderTextColor={tokens.color.textDim}
        value={name}
        onChangeText={setName}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Entry fee (Rp)"
          placeholderTextColor={tokens.color.textDim}
          keyboardType="number-pad"
          value={fee}
          onChangeText={setFee}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Max players"
          placeholderTextColor={tokens.color.textDim}
          keyboardType="number-pad"
          value={maxP}
          onChangeText={setMaxP}
        />
        <TextInput
          style={[styles.input, { width: 90 }]}
          placeholder="Days"
          placeholderTextColor={tokens.color.textDim}
          keyboardType="number-pad"
          value={daysAhead}
          onChangeText={setDaysAhead}
        />
      </View>

      <SectionLabel>Stages · each picks its own format + scoring</SectionLabel>
      {stages.map((s, i) => (
        <Card key={i} style={styles.stage}>
          <View style={styles.stageHead}>
            <View style={styles.stageNo}>
              <Text style={styles.stageNoText}>{i + 1}</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1, padding: 10 }]}
              placeholder={`Stage ${i + 1} name`}
              placeholderTextColor={tokens.color.textDim}
              value={s.name}
              onChangeText={(v) => patchStage(i, { name: v })}
            />
            {stages.length > 1 ? (
              <Pressable onPress={() => setStages((st) => st.filter((_, k) => k !== i))}>
                <Text style={{ color: tokens.color.live, fontWeight: "800", padding: 6 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.pills}>
            {FORMATS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.pill, s.format === f.key && styles.pillOn]}
                onPress={() => patchStage(i, { format: f.key })}
              >
                <Text style={[styles.pillText, s.format === f.key && styles.pillTextOn]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.pills}>
            {(
              [
                ["win_loss", "WIN / LOSS"],
                ["points_accum", "POINTS ACCUMULATION"],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.pill, s.scoring === key && styles.pillOn]}
                onPress={() => patchStage(i, { scoring: key })}
              >
                <Text style={[styles.pillText, s.scoring === key && styles.pillTextOn]}>
                  {label}
                </Text>
              </Pressable>
            ))}
            <TextInput
              style={[styles.input, { width: 110, padding: 8 }]}
              placeholder="Top N adv."
              placeholderTextColor={tokens.color.textDim}
              keyboardType="number-pad"
              value={s.advanceCount ? String(s.advanceCount) : ""}
              onChangeText={(v) => patchStage(i, { advanceCount: Number(v) || undefined })}
            />
          </View>
        </Card>
      ))}
      <Button
        title="+ Add stage"
        kind="secondary"
        onPress={() =>
          setStages((s) => [
            ...s,
            { name: `Stage ${s.length + 1}`, format: "single_elim", scoring: "win_loss" },
          ])
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={busy ? "Creating" : "Create as draft"} onPress={submit} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  input: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 13,
    fontSize: 14,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" },
  pill: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillOn: { borderColor: tokens.color.accent, backgroundColor: `${tokens.color.accent}14` },
  pillText: { color: tokens.color.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  pillTextOn: { color: tokens.color.accent },
  stage: { padding: 12, gap: 10 },
  stageHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  stageNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: tokens.color.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stageNoText: { color: tokens.color.accent, fontWeight: "800", fontSize: 12 },
  error: { color: tokens.color.live, fontSize: 12.5, textAlign: "center" },
});
