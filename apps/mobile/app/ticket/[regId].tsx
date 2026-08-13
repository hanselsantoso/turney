import { StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { tokens } from "@turney/shared";
import { useAuth } from "../../src/stores/auth";
import { Chip } from "../../src/ui";

/* qrToken passed via params to avoid an extra fetch; regId kept for the title */
export default function Ticket() {
  const { regId, qrToken, name, status } = useLocalSearchParams<{
    regId: string;
    qrToken: string;
    name?: string;
    status?: string;
  }>();
  const user = useAuth((s) => s.user);

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: "Entry QR" }} />
      <Chip
        label={(status ?? "registered").replace("_", " ").toUpperCase()}
        tone={status === "checked_in" || status === "paid" ? "win" : "accent"}
      />
      <View style={styles.qrBox}>
        <QRCode value={qrToken ?? regId} size={230} backgroundColor="#ffffff" color="#0c0d10" />
      </View>
      <Text style={styles.who}>
        {user?.displayName?.toUpperCase()} · {user?.playerCode}
      </Text>
      {name ? <Text style={styles.event}>{name}</Text> : null}
      <Text style={styles.hint}>Judge scans this at the venue for check-in and deck verification.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  qrBox: { backgroundColor: "#ffffff", padding: 18, borderRadius: 14 },
  who: {
    color: tokens.color.text,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  event: { color: tokens.color.textDim, fontSize: 13 },
  hint: { color: tokens.color.textDim, fontSize: 12, textAlign: "center", maxWidth: 280 },
});
