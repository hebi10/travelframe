import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useAppAppearance } from "@/lib/app-appearance";
import { initializeAdMob } from "@/lib/admob-config";
import { shouldShowAds } from "@/lib/ad-entitlement";
import { FontLoadProvider } from "@/lib/app-fonts";
import { ensureBodyFrameStage2Migration } from "@/lib/body-frame-stage2-migration";

function AppStack() {
  const { palette, effectiveThemeMode, fontSizeScale, emphasisWeight, fontFamily } = useAppAppearance();
  const { subscription, subscriptionStatus, isAuthLoading, isLoggedIn } = useAuth();
  const eligibleForAds = isLoggedIn && !isAuthLoading && shouldShowAds(subscription, subscriptionStatus);

  useEffect(() => {
    void ensureBodyFrameStage2Migration().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (eligibleForAds) void initializeAdMob();
  }, [eligibleForAds]);

  return (
    <>
      <Stack
        screenOptions={{
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: palette.chrome },
          headerTintColor: palette.text,
          headerTitleStyle: {
            fontSize: Math.round(14 * fontSizeScale),
            fontFamily,
            fontWeight: emphasisWeight
          },
          contentStyle: { backgroundColor: palette.background }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="oauthredirect" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit" options={{ title: "사진 편집", headerShown: false }} />
        <Stack.Screen name="photo/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="capture-preview"
          options={{ title: "미리보기", headerShown: false }}
        />
        <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="video-create" options={{ headerShown: false }} />
        <Stack.Screen name="video-library" options={{ headerShown: false }} />
        <Stack.Screen name="advanced-settings" options={{ headerShown: false }} />
        <Stack.Screen name="legacy-studio" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={effectiveThemeMode === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <FontLoadProvider>
            <AppStack />
          </FontLoadProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
