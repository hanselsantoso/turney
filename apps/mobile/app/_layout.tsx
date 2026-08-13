import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { useAuth } from "../src/stores/auth";

const qc = new QueryClient();

export default function Root() {
  const user = useAuth((s) => s.user);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    const onOnboarding = (segments as string[])[1] === "onboarding";
    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && !user.onboardedAt && !onOnboarding) {
      router.replace("/onboarding");
    } else if (user && user.onboardedAt && inAuthGroup) {
      router.replace("/home");
    }
  }, [user, segments, router]);

  return (
    <QueryClientProvider client={qc}>
      <View style={styles.outer}>
        <View style={styles.frame}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: tokens.color.surface },
              headerTintColor: tokens.color.text,
              contentStyle: { backgroundColor: tokens.color.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </View>
      </View>
    </QueryClientProvider>
  );
}

/* On web the app renders as a centered phone-width column against a darker
   page ground (matches the design prototype's device frames). Native fills
   the screen as usual. Desktop-wide admin layouts come with organizer tools. */
const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#08090b" : tokens.color.bg,
    alignItems: "center",
  },
  frame: {
    flex: 1,
    width: "100%",
    ...(Platform.OS === "web"
      ? {
          maxWidth: 520,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: tokens.color.border,
        }
      : null),
  },
});
