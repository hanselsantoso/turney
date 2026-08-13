import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/stores/auth";
import { Button, Card, Chip, SectionLabel } from "../../src/ui";

type Part = {
  id: string;
  kind: "blade" | "ratchet" | "bit" | "assist_blade";
  name: string;
  attack: number;
  defense: number;
  stamina: number;
  type: string | null;
  points: number | null;
};
type SlotDraft = { bladeId?: string; ratchetId?: string; bitId?: string };
type Deck = {
  id: string;
  name: string;
  slots: Array<{ slot: number; bladeId: string; ratchetId: string; bitId: string }>;
};

const KIND_LABEL = { blade: "Blade", ratchet: "Ratchet", bit: "Bit" } as const;

export default function Decks() {
  const token = useAuth((s) => s.accessToken);
  const qc = useQueryClient();
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([{}, {}, {}]);
  const [picker, setPicker] = useState<{ slot: number; kind: keyof typeof KIND_LABEL } | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parts = useQuery<Part[]>({ queryKey: ["parts"], queryFn: () => api("/parts") });
  const decks = useQuery<Deck[]>({
    queryKey: ["decks"],
    queryFn: () => api("/decks", {}, token),
    enabled: !!token,
  });

  const byId = useMemo(() => new Map((parts.data ?? []).map((p) => [p.id, p])), [parts.data]);
  const pickerParts = useMemo(() => {
    if (!picker) return [];
    const q = search.trim().toLowerCase();
    return (parts.data ?? [])
      .filter((p) => p.kind === picker.kind)
      .filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [parts.data, picker, search]);

  const complete = slots.every((s) => s.bladeId && s.ratchetId && s.bitId);

  async function save() {
    setError(null);
    try {
      await api(
        "/decks",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() || "My Deck", slots }),
        },
        token,
      );
      qc.invalidateQueries({ queryKey: ["decks"] });
      setBuilding(false);
      setName("");
      setSlots([{}, {}, {}]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function PartRow({ slot, kind }: { slot: number; kind: keyof typeof KIND_LABEL }) {
    const idKey = `${kind}Id` as keyof SlotDraft;
    const part = slots[slot][idKey] ? byId.get(slots[slot][idKey]!) : null;
    return (
      <Pressable
        style={[styles.partRow, !part && styles.partRowEmpty]}
        onPress={() => {
          setSearch("");
          setPicker({ slot, kind });
        }}
      >
        {part ? (
          <>
            <Text style={styles.partName}>{part.name}</Text>
            <StatBars p={part} />
          </>
        ) : (
          <Text style={styles.partEmpty}>+ Select {KIND_LABEL[kind].toLowerCase()}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Decks" }} />

      {!building ? (
        <>
          <Button title="+ Build new deck" onPress={() => setBuilding(true)} />
          <SectionLabel>{`My decks · ${decks.data?.length ?? 0}`}</SectionLabel>
          {(decks.data ?? []).map((d) => (
            <Card key={d.id} style={{ padding: 14, gap: 6 }}>
              <Text style={styles.deckName}>{d.name}</Text>
              {d.slots.map((s) => (
                <Text key={s.slot} style={styles.deckSlot} numberOfLines={1}>
                  {s.slot}. {byId.get(s.bladeId)?.name ?? "?"} · {byId.get(s.ratchetId)?.name ?? "?"} ·{" "}
                  {byId.get(s.bitId)?.name ?? "?"}
                </Text>
              ))}
            </Card>
          ))}
          {(decks.data ?? []).length === 0 ? (
            <Text style={styles.dim}>No decks yet. Build your 3-bey deck.</Text>
          ) : null}
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Deck name"
            placeholderTextColor={tokens.color.textDim}
            value={name}
            onChangeText={setName}
          />
          {slots.map((_, i) => (
            <Card key={i} style={{ padding: 12, gap: 8 }}>
              <Text style={styles.slotHead}>BEYBLADE {i + 1}</Text>
              <PartRow slot={i} kind="blade" />
              <PartRow slot={i} kind="ratchet" />
              <PartRow slot={i} kind="bit" />
            </Card>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Save deck" onPress={save} disabled={!complete} />
          <Button title="Cancel" kind="secondary" onPress={() => setBuilding(false)} />
        </>
      )}

      <Modal visible={!!picker} animationType="slide" transparent>
        <View style={styles.modalScrim}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                Select {picker ? KIND_LABEL[picker.kind].toLowerCase() : ""}
              </Text>
              <Pressable onPress={() => setPicker(null)}>
                <Text style={{ color: tokens.color.textDim, fontSize: 18, padding: 4 }}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Search parts"
              placeholderTextColor={tokens.color.textDim}
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={pickerParts}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickRow}
                  onPress={() => {
                    if (picker) {
                      const idKey = `${picker.kind}Id` as keyof SlotDraft;
                      setSlots((s) =>
                        s.map((slot, k) => (k === picker.slot ? { ...slot, [idKey]: item.id } : slot)),
                      );
                    }
                    setPicker(null);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partName}>{item.name}</Text>
                    {item.type ? <Chip label={item.type.toUpperCase()} tone="dim" /> : null}
                  </View>
                  <StatBars p={item} />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatBars({ p }: { p: Part }) {
  const max = 100;
  return (
    <View style={styles.bars}>
      {[p.attack, p.defense, p.stamina].map((v, i) => (
        <View key={i} style={styles.barTrack}>
          <View
            style={[styles.barFill, { width: `${Math.min(100, (v / max) * 100)}%` }]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 16, gap: 12, paddingBottom: 60 },
  dim: { color: tokens.color.textDim, fontSize: 13, textAlign: "center", marginTop: 20 },
  input: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 13,
    fontSize: 14,
  },
  slotHead: { color: tokens.color.textDim, fontSize: 10.5, letterSpacing: 1.4, fontWeight: "700" },
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  partRowEmpty: { backgroundColor: "transparent", borderStyle: "dashed" },
  partName: { color: tokens.color.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  partEmpty: { color: tokens.color.textDim, fontSize: 13 },
  deckName: { color: tokens.color.text, fontWeight: "800", fontSize: 15 },
  deckSlot: { color: tokens.color.textDim, fontSize: 12 },
  bars: { gap: 3, marginLeft: "auto", width: 46 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: tokens.color.border, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2, backgroundColor: tokens.color.accent },
  modalScrim: { flex: 1, backgroundColor: "#08090bd9", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 16,
    gap: 12,
    maxHeight: "80%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { color: tokens.color.text, fontWeight: "800", fontSize: 15 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surface2,
  },
  error: { color: tokens.color.live, fontSize: 12.5, textAlign: "center" },
});
