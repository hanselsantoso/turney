import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { tokens } from "@turney/shared";
import { useAuth } from "../src/stores/auth";
import { Button, glow } from "../src/ui";

/* Native app opens straight into the product; the landing page is the
   website's front door (web guests only). */
export default function Index() {
  const user = useAuth((s) => s.user);
  if (Platform.OS !== "web") return <Redirect href={user ? "/home" : "/login"} />;
  if (user) return <Redirect href="/home" />;
  return <Landing />;
}

function SpinningBey({ color, size, reverse }: { color: string; size: number; reverse?: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: reverse ? 680 : 550,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, reverse]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ["360deg", "0deg"] : ["0deg", "360deg"],
  });
  return (
    <Animated.View
      style={[
        bey.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          transform: [{ rotateX: "54deg" }, { rotate }],
        },
        glow(color, 22, 0.35),
      ]}
    >
      <View style={[bey.inner, { borderColor: `${color}88`, borderRadius: size / 2 }]} />
      <Text style={[bey.x, { color }]}>X</Text>
      <View style={[bey.fin, { backgroundColor: color, top: 4, left: size / 2 - 3 }]} />
      <View style={[bey.fin, { backgroundColor: color, bottom: 4, left: size / 2 - 3 }]} />
      <View style={[bey.fin, { backgroundColor: color, left: 4, top: size / 2 - 3 }]} />
      <View style={[bey.fin, { backgroundColor: color, right: 4, top: size / 2 - 3 }]} />
    </Animated.View>
  );
}

const bey = StyleSheet.create({
  disc: {
    borderWidth: 2,
    backgroundColor: tokens.color.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { position: "absolute", inset: 14, borderWidth: 1.5 } as never,
  x: { fontWeight: "900", fontSize: 22, fontVariant: ["tabular-nums"] },
  fin: { position: "absolute", width: 6, height: 6, borderRadius: 3, opacity: 0.9 },
});

function Landing() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width > 840;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      {/* nav */}
      <View style={s.nav}>
        <Text style={s.wordmark}>
          TUR<Text style={{ color: tokens.color.accent }}>NEY</Text>
        </Text>
        <Pressable style={s.navCta} onPress={() => router.push("/login")}>
          <Text style={s.navCtaText}>SIGN IN</Text>
        </Pressable>
      </View>

      {/* hero */}
      <View style={[s.hero, wide && s.heroWide]}>
        <View style={{ flex: 1, gap: 18 }}>
          <Text style={s.eyebrow}>3 · 2 · 1 ···</Text>
          <Text style={s.h1}>
            WHERE{"\n"}CHAMPIONS{"\n"}
            <Text style={[{ color: tokens.color.accent }, s.h1Glow]}>ARE MADE</Text>
          </Text>
          <Text style={s.sub}>
            Beyblade X tournaments with live brackets, ELO rankings, deck verification, and real
            prize pools. Run by communities, for communities.
          </Text>
          <View style={s.ctas}>
            <Pressable
              style={[s.mainCta, glow(tokens.color.accent, 24, 0.35)]}
              onPress={() => router.push("/register")}
            >
              <Text style={s.mainCtaText}>JOIN THE ARENA</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/login")}>
              <Text style={s.secCta}>I HAVE AN ACCOUNT</Text>
            </Pressable>
          </View>
        </View>
        <View style={[s.stage, !wide && { height: 240 }]}>
          <View style={{ position: "absolute", left: "6%", top: 90 }}>
            <SpinningBey color={tokens.color.accent} size={wide ? 170 : 120} />
          </View>
          <View style={{ position: "absolute", right: "6%", top: 30 }}>
            <SpinningBey color={tokens.color.live} size={wide ? 170 : 120} reverse />
          </View>
        </View>
      </View>

      {/* stats strip */}
      <View style={s.stats}>
        {[
          ["4", "BRACKET FORMATS"],
          ["234", "PARTS IN CATALOG"],
          ["ELO", "LIVE RANKING"],
          ["QR", "VENUE CHECK-IN"],
        ].map(([v, l]) => (
          <View key={l} style={s.stat}>
            <Text style={s.statV}>{v}</Text>
            <Text style={s.statL}>{l}</Text>
          </View>
        ))}
      </View>

      {/* features */}
      <View style={[s.feats, wide && { flexDirection: "row" }]}>
        {[
          [
            "Multi-stage formats",
            "Round robin groups into double elimination into a single-elim final. Each stage picks its own scoring. Any combination, Challonge-style.",
          ],
          [
            "Everyone is a player",
            "Judges and organizers play too. Staff roles are per-tournament grants, and nobody ever judges their own match.",
          ],
          [
            "Community-run",
            "Leaders host events in their own colors, take cash on the spot, and move players between groups when reality happens.",
          ],
        ].map(([h, p]) => (
          <View key={h} style={s.feat}>
            <Text style={s.featH}>{h}</Text>
            <Text style={s.featP}>{p}</Text>
          </View>
        ))}
      </View>

      <View style={{ paddingVertical: 20, alignSelf: "center", width: "100%", maxWidth: 380 }}>
        <Button title="Create your account" onPress={() => router.push("/register")} />
      </View>

      <View style={s.footer}>
        <Text style={s.footText}>turney.id</Text>
        <Text style={s.footText}>Built for the Beyblade X community</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.bg },
  content: { paddingHorizontal: 24, paddingBottom: 30 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: `${tokens.color.border}88`,
  },
  wordmark: { color: tokens.color.text, fontWeight: "800", letterSpacing: 3, fontSize: 15 },
  navCta: {
    backgroundColor: tokens.color.accent,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  navCtaText: { color: tokens.color.bg, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  hero: { paddingVertical: 48, gap: 30 },
  heroWide: { flexDirection: "row", alignItems: "center" },
  eyebrow: {
    color: tokens.color.accent,
    fontSize: 10,
    letterSpacing: 5,
    fontVariant: ["tabular-nums"],
  },
  h1: {
    color: tokens.color.text,
    fontSize: 56,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -1,
  },
  h1Glow: Platform.OS === "web" ? ({ textShadow: `0 0 44px ${tokens.color.accent}66` } as never) : {},
  sub: { color: tokens.color.textDim, fontSize: 15, lineHeight: 23, maxWidth: 420 },
  ctas: { flexDirection: "row", gap: 20, alignItems: "center", flexWrap: "wrap" },
  mainCta: { backgroundColor: tokens.color.accent, paddingHorizontal: 34, paddingVertical: 16 },
  mainCtaText: { color: tokens.color.bg, fontWeight: "800", fontSize: 13.5, letterSpacing: 1 },
  secCta: {
    color: tokens.color.text,
    fontWeight: "700",
    fontSize: 12.5,
    letterSpacing: 0.6,
    borderBottomWidth: 2,
    borderBottomColor: `${tokens.color.accent}88`,
    paddingBottom: 2,
  },
  stage: { flex: 1, height: 320, position: "relative", minWidth: 280 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${tokens.color.border}88`,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    paddingVertical: 20,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: `${tokens.color.border}55`,
  },
  statV: {
    color: tokens.color.accent,
    fontWeight: "800",
    fontSize: 26,
    fontVariant: ["tabular-nums"],
  },
  statL: { color: tokens.color.textDim, fontSize: 9.5, letterSpacing: 1.6, marginTop: 4 },
  feats: { gap: 14, paddingVertical: 36 },
  feat: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 20,
    gap: 8,
  },
  featH: { color: tokens.color.text, fontWeight: "800", fontSize: 15 },
  featP: { color: tokens.color.textDim, fontSize: 13, lineHeight: 19 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 22,
    borderTopWidth: 1,
    borderTopColor: `${tokens.color.border}88`,
  },
  footText: { color: tokens.color.textDim, fontSize: 12 },
});
