import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { tokens } from "@turney/shared";

function icon(glyph: string) {
  return ({ color }: { color: ColorValue }) => (
    <Text style={{ fontSize: 17, color: color as string }}>{glyph}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.color.surface },
        headerTintColor: tokens.color.text,
        tabBarStyle: {
          backgroundColor: tokens.color.surface,
          borderTopColor: tokens.color.border,
        },
        tabBarActiveTintColor: tokens.color.accent,
        tabBarInactiveTintColor: tokens.color.textDim,
        sceneStyle: { backgroundColor: tokens.color.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("⌂") }} />
      <Tabs.Screen
        name="tournaments"
        options={{ title: "Tournaments", tabBarIcon: icon("▦") }}
      />
      <Tabs.Screen name="decks" options={{ title: "Decks", tabBarIcon: icon("◎") }} />
      <Tabs.Screen
        name="leaderboard"
        options={{ title: "Rank", tabBarIcon: icon("◇") }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("◉") }} />
    </Tabs>
  );
}
