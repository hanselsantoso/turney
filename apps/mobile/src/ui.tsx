import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { tokens } from "@turney/shared";

export function Chip({
  label,
  tone = "dim",
}: {
  label: string;
  tone?: "accent" | "live" | "win" | "dim";
}) {
  const colors = {
    accent: { bg: `${tokens.color.accent}26`, fg: tokens.color.accent },
    live: { bg: `${tokens.color.live}26`, fg: tokens.color.live },
    win: { bg: `${tokens.color.win}26`, fg: tokens.color.win },
    dim: { bg: "#9aa1ad1f", fg: tokens.color.textDim },
  }[tone];
  return (
    <View style={[chip.base, { backgroundColor: colors.bg }]}>
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
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
});

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

export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
}: {
  title: string;
  onPress?: () => void;
  kind?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        btn.base,
        kind === "primary" ? btn.primary : btn.secondary,
        pressed && btn.pressed,
        disabled && btn.disabled,
      ]}
    >
      <Text style={[btn.text, kind === "primary" ? btn.textPrimary : btn.textSecondary]}>
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
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
  text: { fontWeight: "700", fontSize: 14.5 },
  textPrimary: { color: tokens.color.bg },
  textSecondary: { color: tokens.color.text },
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

export const mono = { fontVariant: ["tabular-nums" as const] };
