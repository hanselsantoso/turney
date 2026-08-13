import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { tokens } from "@turney/shared";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/stores/auth";
import { Button, Card, Display, SectionLabel } from "../../src/ui";

const TYPES = ["Attack", "Defense", "Stamina", "Balance"];

export default function Onboarding() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.accessToken);
  const setUser = useAuth((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [fav, setFav] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish(skip = false) {
    setBusy(true);
    setError(null);
    try {
      const me = await api(
        "/users/me",
        {
          method: "PATCH",
          body: JSON.stringify(
            skip
              ? { onboarded: true }
              : {
                  city: city.trim() || null,
                  region: region.trim() || null,
                  birthYear: birthYear ? Number(birthYear) : null,
                  gender: gender.trim() || null,
                  onboarded: true,
                },
          ),
        },
        token,
      );
      setUser(me); // onboardedAt now set -> root layout routes to /home
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />
        ))}
      </View>

      {step === 0 ? (
        <View style={styles.step}>
          <Display size={34} accentLast>
            3 2 1 GO SHOOT
          </Display>
          <Text style={styles.lead}>
            Welcome, {user?.displayName}. Tournaments, live brackets, ELO ranking, and your deck
            collection. Two quick steps to set you up.
          </Text>
          <Button title="Let's go" onPress={() => setStep(1)} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.step}>
          <Text style={styles.h2}>About you</Text>
          <Text style={styles.dim}>
            Helps us suggest communities near you. Everything optional.
          </Text>
          <SectionLabel>City</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="e.g. Jakarta Selatan"
            placeholderTextColor={tokens.color.textDim}
            value={city}
            onChangeText={setCity}
          />
          <SectionLabel>Region / province</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="e.g. DKI Jakarta"
            placeholderTextColor={tokens.color.textDim}
            value={region}
            onChangeText={setRegion}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <SectionLabel>Birth year</SectionLabel>
              <TextInput
                style={styles.input}
                placeholder="2004"
                placeholderTextColor={tokens.color.textDim}
                keyboardType="number-pad"
                value={birthYear}
                onChangeText={setBirthYear}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <SectionLabel>Gender (optional)</SectionLabel>
              <TextInput
                style={styles.input}
                placeholder="Self-described"
                placeholderTextColor={tokens.color.textDim}
                value={gender}
                onChangeText={setGender}
              />
            </View>
          </View>
          <Button title="Continue" onPress={() => setStep(2)} />
          <Pressable onPress={() => finish(true)}>
            <Text style={styles.skip}>Skip for now</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.step}>
          <Text style={styles.h2}>Make it yours</Text>
          <SectionLabel>Favorite type</SectionLabel>
          <View style={styles.pills}>
            {TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.pill, fav === t && styles.pillOn]}
                onPress={() => setFav(fav === t ? null : t)}
              >
                <Text style={[styles.pillText, fav === t && styles.pillTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Card style={{ padding: 14 }}>
            <Text style={styles.dim}>
              Your player code:{" "}
              <Text style={{ color: tokens.color.accent, fontWeight: "800" }}>
                {user?.playerCode}
              </Text>
              {"\n"}Staff use this to add you to tournaments on the spot.
            </Text>
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={busy ? "Saving" : "Enter the arena"} onPress={() => finish()} disabled={busy} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { padding: 26, paddingTop: 60, gap: 18, flexGrow: 1, justifyContent: "center" },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center" },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: tokens.color.border },
  dotOn: { backgroundColor: tokens.color.accent },
  dotDone: { backgroundColor: `${tokens.color.accent}77` },
  step: { gap: 14 },
  lead: { color: tokens.color.textDim, fontSize: 14.5, lineHeight: 21 },
  h2: { color: tokens.color.text, fontSize: 22, fontWeight: "800" },
  dim: { color: tokens.color.textDim, fontSize: 13, lineHeight: 19 },
  input: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    color: tokens.color.text,
    padding: 13,
    fontSize: 14.5,
  },
  skip: { color: tokens.color.textDim, textAlign: "center", fontSize: 13, padding: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pillOn: { borderColor: tokens.color.accent, backgroundColor: `${tokens.color.accent}14` },
  pillText: { color: tokens.color.textDim, fontSize: 13, fontWeight: "700" },
  pillTextOn: { color: tokens.color.accent },
  error: { color: tokens.color.live, fontSize: 12.5, textAlign: "center" },
});
