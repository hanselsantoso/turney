import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../../src/stores/auth";
import { useMyRegistrations, useRegister, useTournament } from "../../src/api/hooks";
import { useCommunityAccent } from "../../src/theme";
import { Banner, Button, Card, Chip, Display, SectionLabel } from "../../src/ui";

const FORMAT_LABEL: Record<string, string> = {
  round_robin: "Round Robin",
  swiss: "Swiss",
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
};

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { data: t } = useTournament(id);
  const regs = useMyRegistrations(id);
  const register = useRegister(id);

  const mine = (regs.data ?? []).find((r) => r.userId === user?.id);
  const canRegister = t?.status === "reg_open" && !mine;
  const accent = useCommunityAccent(t?.communityId);

  if (!t) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Tournament" }} />
        <Text style={{ color: tokens.color.textDim }}>Loading</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.name }} />
      <Banner color={accent}>
        <Chip
          label={t.status.replace("_", " ").toUpperCase()}
          tone={t.status === "in_progress" ? "live" : t.status === "reg_open" ? "accent" : "dim"}
          glowing={t.status === "in_progress"}
        />
        <Display size={30} accentLast>
          {t.name}
        </Display>
        <Text style={styles.meta}>
          {new Date(t.startsAt).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {"  ·  "}
          {t.entryFee > 0 ? `Rp ${t.entryFee.toLocaleString("id-ID")}` : "Free entry"}
          {"  ·  max "}
          {t.maxParticipants}
        </Text>
      </Banner>

      {t.prizePool?.length ? (
        <>
          <SectionLabel>Prize pool</SectionLabel>
          <Card>
            {t.prizePool.map((p) => (
              <View key={p.place} style={styles.prizeRow}>
                <Text
                  style={[
                    styles.prizePlace,
                    p.place === 1 && { color: "#ffb020" },
                  ]}
                >
                  {p.place === 1 ? "1st" : p.place === 2 ? "2nd" : p.place === 3 ? "3rd" : `${p.place}th`}
                </Text>
                <Text style={styles.prizeText}>{p.prize}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel>{`Format · ${t.stages?.length ?? 0} stage${(t.stages?.length ?? 0) > 1 ? "s" : ""}`}</SectionLabel>
      <Card>
        {(t.stages ?? []).map((s) => (
          <View key={s.id} style={styles.stageRow}>
            <View style={styles.stageNo}>
              <Text style={styles.stageNoText}>{s.seq}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stageName}>
                {s.name} · {FORMAT_LABEL[s.format] ?? s.format}
              </Text>
              <Text style={styles.stageMeta}>
                {s.scoring === "points_accum" ? "POINTS ACCUMULATION" : "WIN / LOSS"}
                {s.advanceCount ? `  ·  TOP ${s.advanceCount} ADVANCE` : ""}
                {s.roundsPlanned ? `  ·  ${s.roundsPlanned} ROUNDS` : ""}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {mine ? (
        <Card style={{ padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Chip
              label={mine.status.replace("_", " ").toUpperCase()}
              tone={mine.status === "checked_in" ? "win" : mine.status === "paid" ? "win" : "accent"}
            />
            <Text style={{ color: tokens.color.textDim, fontSize: 12.5 }}>
              {mine.status === "pending" && t.entryFee > 0
                ? `Registered · pay Rp ${t.entryFee.toLocaleString("id-ID")} cash at the venue`
                : "You are registered"}
            </Text>
          </View>
          <Button
            title="Show my entry QR"
            kind="secondary"
            onPress={() =>
              router.push({
                pathname: "/ticket/[regId]",
                params: { regId: mine.id, qrToken: mine.qrToken, name: t.name, status: mine.status },
              })
            }
          />
        </Card>
      ) : null}

      {mine ? (
        <Button
          title="My tournament dashboard"
          onPress={() => router.push(`/tournament/dashboard/${id}`)}
        />
      ) : null}
      <Button
        title="View bracket"
        kind="secondary"
        onPress={() => router.push(`/tournament/bracket/${id}`)}
      />

      {canRegister ? (
        <Button
          title={
            register.isPending
              ? "Registering"
              : t.entryFee > 0
                ? `Register · Rp ${t.entryFee.toLocaleString("id-ID")}`
                : "Register · Free"
          }
          onPress={() => register.mutate()}
          disabled={register.isPending}
        />
      ) : null}
      {register.isError ? (
        <Text style={styles.error}>{(register.error as Error).message}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  meta: { color: tokens.color.textDim, fontSize: 12.5 },
  prizeRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
  },
  prizePlace: {
    width: 36,
    color: tokens.color.accent,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  prizeText: { color: tokens.color.text, flex: 1, fontSize: 13.5 },
  stageRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
    alignItems: "flex-start",
  },
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
  stageName: { color: tokens.color.text, fontWeight: "700", fontSize: 13.5 },
  stageMeta: {
    color: tokens.color.textDim,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  qrHint: { color: tokens.color.textDim, fontSize: 12, lineHeight: 18 },
  error: { color: tokens.color.live, fontSize: 12.5, textAlign: "center" },
});
