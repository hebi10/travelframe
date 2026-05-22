import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth-context";
import { useAppAppearance } from "@/lib/app-appearance";
import { initializeAdMob } from "@/lib/admob-config";
import { FontLoadProvider } from "@/lib/app-fonts";

function AppStack() {
  const { palette, effectiveThemeMode, fontSizeScale, emphasisWeight, fontFamily } = useAppAppearance();

  useEffect(() => {
    void initializeAdMob();
  }, []);

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
        <Stack.Screen name="photo/[id]" options={{ title: "사진" }} />
        <Stack.Screen
          name="capture-preview"
          options={{ title: "미리보기", headerShown: false }}
        />
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
