import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { tokens } from "@turney/shared";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/stores/auth";
import { Button, Card, Chip, SectionLabel } from "../../src/ui";

/* Native: live camera QR scan. Web + fallback: manual token entry.
   Both feed the same /qr/resolve path. */

type Resolved = {
  registration: { id: string; status: string; tournamentId: string };
  deck: { name: string; slots: Array<{ slot: number }> } | null;
  verifications: Array<{ status: string }>;
};

export default function JudgeScan() {
  const token = useAuth((s) => s.accessToken);
  const router = useRouter();
  const [qr, setQr] = useState("");
  const [found, setFound] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();

  async function onBarcode(data: string) {
    if (busy || !data) return;
    setCamOn(false);
    setQr(data);
    await resolveToken(data);
  }

  async function resolveToken(value: string) {
    setError(null);
    setBusy(true);
    try {
      const r = (await api(
        "/qr/resolve",
        { method: "POST", body: JSON.stringify({ qrToken: value.trim() }) },
        token,
      )) as Resolved;
      setFound(r);
    } catch (e) {
      setFound(null);
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    await resolveToken(qr);
  }

  async function verify(status: "approved" | "rejected") {
    if (!found) return;
    setBusy(true);
    try {
      await api(
        `/registrations/${found.registration.id}/verify-deck`,
        { method: "POST", body: JSON.stringify({ status }) },
        token,
      );
      await resolve();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  const lastVerification = found?.verifications.at(-1);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Judge · Scan" }} />

      {Platform.OS !== "web" ? (
        camOn && perm?.granted ? (
          <View style={styles.camWrap}>
            <CameraView
              style={styles.cam}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(e) => onBarcode(e.data)}
            />
            <Button title="Stop camera" kind="secondary" onPress={() => setCamOn(false)} />
          </View>
        ) : (
          <Button
            title="Scan with camera"
            onPress={async () => {
              if (!perm?.granted) {
                const r = await requestPerm();
                if (!r.granted) return setError("Camera permission denied");
              }
              setCamOn(true);
            }}
          />
        )
      ) : null}

      <SectionLabel>
        {Platform.OS === "web" ? "Player QR token" : "Or enter token manually"}
      </SectionLabel>
      <TextInput
        style={styles.input}
        placeholder="Paste or type the QR token"
        placeholderTextColor={tokens.color.textDim}
        autoCapitalize="none"
        value={qr}
        onChangeText={setQr}
      />
      <Button title={busy ? "Resolving" : "Resolve player"} onPress={resolve} disabled={busy || !qr.trim()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {found ? (
        <Card style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Chip
              label={found.registration.status.replace("_", " ").toUpperCase()}
              tone={found.registration.status === "checked_in" ? "win" : "accent"}
            />
            {lastVerification ? (
              <Chip
                label={`DECK ${lastVerification.status.toUpperCase()}`}
                tone={lastVerification.status === "approved" ? "win" : "live"}
              />
            ) : (
              <Chip label="DECK UNVERIFIED" tone="dim" />
            )}
          </View>
          <Text style={styles.deck}>
            {found.deck
              ? `Deck: ${found.deck.name} · ${found.deck.slots.length} beys`
              : "No deck attached yet"}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Approve deck" onPress={() => verify("approved")} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Reject"
                kind="secondary"
                onPress={() => verify("rejected")}
                disabled={busy}
              />
            </View>
          </View>
          <Button
            title="Open matches for this tournament"
            kind="secondary"
            onPress={() => router.push(`/judge/matches/${found.registration.tournamentId}`)}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  input: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 14,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  error: { color: tokens.color.live, fontSize: 12.5 },
  deck: { color: tokens.color.text, fontSize: 13.5 },
  camWrap: { gap: 10 },
  cam: { height: 280, borderRadius: tokens.radius.md, overflow: "hidden" },
});
