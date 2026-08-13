import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tokens } from "@turney/shared";

/* ---------- glow (rationed: live indicators + primary CTA + hero) ---------- */
export const glow = (color: string, radius = 14, opacity = 0.4): ViewStyle =>
  Platform.OS === "web"
    ? ({ boxShadow: `0 0 ${radius}px ${color}${Math.round(opacity * 255).toString(16)}` } as ViewStyle)
    : { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } };

/* ---------- display type: the broadcast voice ---------- */
export function Display({
  children,
  size = 26,
  accentLast = false,
}: {
  children: string;
  size?: number;
  accentLast?: boolean;
}) {
  const words = children.toUpperCase().split(" ");
  const last = accentLast ? words.pop() : null;
  return (
    <Text
      style={{
        color: tokens.color.text,
        fontSize: size,
        fontWeight: "900",
        letterSpacing: -0.5,
        lineHeight: size * 1.02,
        transform: [{ scaleX: 0.92 }],
      }}
    >
      {words.join(" ")}
      {last ? (
        <Text style={{ color: tokens.color.accent }}> {last}</Text>
      ) : null}
    </Text>
  );
}

/* ---------- chips ---------- */
export function Chip({
  label,
  tone = "dim",
  glowing = false,
}: {
  label: string;
  tone?: "accent" | "live" | "win" | "dim" | "amber";
  glowing?: boolean;
}) {
  const colors = {
    accent: { bg: `${tokens.color.accent}26`, fg: tokens.color.accent },
    live: { bg: `${tokens.color.live}26`, fg: tokens.color.live },
    win: { bg: `${tokens.color.win}26`, fg: tokens.color.win },
    amber: { bg: "#e2a53326", fg: "#e2a533" },
    dim: { bg: "#9aa1ad1f", fg: tokens.color.textDim },
  }[tone];
  return (
    <View
      style={[
        chip.base,
        { backgroundColor: colors.bg },
        glowing && glow(colors.fg, 10, 0.35),
      ]}
    >
      {tone === "live" ? <View style={[chip.dot, { backgroundColor: colors.fg }]} /> : null}
      <Text style={[chip.text, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
});

/* ---------- surfaces ---------- */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[card.base, style]}>{children}</View>;
}

const card = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
  },
});

/* Hero banner: accent-tinted gradient ground, the prototype's hype surface */
export function Banner({
  children,
  color = tokens.color.accent,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[banner.wrap, { borderColor: `${color}55` }, glow(color, 18, 0.14), style]}>
      <LinearGradient
        colors={[`${color}30`, `${color}0a`, tokens.color.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={banner.inner}>{children}</View>
    </View>
  );
}

const banner = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: tokens.color.surface,
  },
  inner: { padding: 16, gap: 8 },
});

/* ---------- buttons ---------- */
export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
}: {
  title: string;
  onPress?: () => void;
  kind?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        btn.base,
        kind === "primary" && btn.primary,
        kind === "primary" && !disabled && glow(tokens.color.accent, 14, 0.3),
        kind === "secondary" && btn.secondary,
        kind === "danger" && btn.danger,
        pressed && btn.pressed,
        disabled && btn.disabled,
      ]}
    >
      <Text
        style={[
          btn.text,
          kind === "primary" ? btn.textPrimary : kind === "danger" ? btn.textDanger : btn.textSecondary,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const btn = StyleSheet.create({
  base: { borderRadius: tokens.radius.md, padding: 15, alignItems: "center" },
  primary: { backgroundColor: tokens.color.accent },
  secondary: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: `${tokens.color.live}22`,
    borderColor: `${tokens.color.live}44`,
    borderWidth: 1,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
  text: { fontWeight: "700", fontSize: 14.5 },
  textPrimary: { color: tokens.color.bg },
  textSecondary: { color: tokens.color.text },
  textDanger: { color: tokens.color.live },
});

export function SectionLabel({ children }: { children: string }) {
  return <Text style={sec.label}>{children}</Text>;
}

const sec = StyleSheet.create({
  label: {
    fontSize: 11.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: tokens.color.textDim,
    fontWeight: "700",
  },
});

/* mono numerals helper */
export const mono = { fontVariant: ["tabular-nums" as const] };

/* Stat tile: dim label + huge mono number (broadcast scoreboard voice) */
export function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card style={stat.tile}>
      <Text style={stat.label}>{label.toUpperCase()}</Text>
      <Text style={[stat.value, color ? { color } : null]}>{value}</Text>
    </Card>
  );
}

const stat = StyleSheet.create({
  tile: { flex: 1, padding: 12 },
  label: { color: tokens.color.textDim, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  value: {
    color: tokens.color.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
});
