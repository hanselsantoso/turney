import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@turney/shared";
import { useTournaments } from "../../src/api/hooks";
import { Card, Chip } from "../../src/ui";

const STATUS_TONE: Record<string, "accent" | "live" | "win" | "dim"> = {
  reg_open: "accent",
  in_progress: "live",
  completed: "dim",
  check_in: "win",
  reg_closed: "dim",
  draft: "dim",
};

export default function Tournaments() {
  const router = useRouter();
  const { data, isLoading } = useTournaments();

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(t) => t.id}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {isLoading ? "Loading tournaments" : "No tournaments yet."}
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/tournament/${item.id}`)}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Chip
                label={item.status.replace("_", " ").toUpperCase()}
                tone={STATUS_TONE[item.status] ?? "dim"}
              />
            </View>
            <Text style={styles.meta}>
              {new Date(item.startsAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {"  ·  "}
              {item.entryFee > 0 ? `Rp ${item.entryFee.toLocaleString("id-ID")}` : "Free"}
              {"  ·  max "}
              {item.maxParticipants}
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
  card: { padding: 14, gap: 7 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: tokens.color.text, fontWeight: "700", fontSize: 14.5, flex: 1, marginRight: 8 },
  meta: { color: tokens.color.textDim, fontSize: 12, fontVariant: ["tabular-nums"] },
  empty: { color: tokens.color.textDim, textAlign: "center", marginTop: 60 },
});
