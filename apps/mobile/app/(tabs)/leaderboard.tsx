import { FlatList, StyleSheet, Text, View } from "react-native";
import { tokens } from "@turney/shared";
import { useLeaderboard } from "../../src/api/hooks";

export default function Leaderboard() {
  const { data, isLoading } = useLeaderboard();

  return (
    <FlatList
      style={styles.wrap}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(r) => r.id}
      ListEmptyComponent={
        <Text style={styles.empty}>{isLoading ? "Loading" : "No ranked players yet."}</Text>
      }
      renderItem={({ item, index }) => (
        <View style={[styles.row, index === 0 && styles.first]}>
          <Text style={[styles.rank, index === 0 && { color: tokens.color.accent }]}>
            {index + 1}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.code}>
              {item.playerCode}
              {item.city ? `  ·  ${item.city}` : ""}
            </Text>
          </View>
          <Text style={styles.elo}>{item.elo}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
  },
  first: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.md,
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: `${tokens.color.accent}55`,
  },
  rank: {
    width: 28,
    color: tokens.color.textDim,
    fontWeight: "800",
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  name: { color: tokens.color.text, fontWeight: "700", fontSize: 14.5 },
  code: { color: tokens.color.textDim, fontSize: 11.5, fontVariant: ["tabular-nums"] },
  elo: {
    color: tokens.color.text,
    fontWeight: "800",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  empty: { color: tokens.color.textDim, textAlign: "center", marginTop: 60 },
});
