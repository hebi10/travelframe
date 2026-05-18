import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabGlyph } from "@/components/tab-glyph";
import { useAuth } from "@/lib/auth-context";
import { useAppAppearance } from "@/lib/app-appearance";

const MAX_APP_WIDTH = 750;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const { isLoggedIn } = useAuth();
  const tabBarBottomPadding = Math.max(Math.round(insets.bottom * 0.5) + 4, 10);
  const tabBarHeight = 58 + tabBarBottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerTitleStyle: {
          fontSize: 14,
          fontWeight: "800"
        },
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: palette.faint,
        tabBarStyle: {
          height: tabBarHeight,
          width: "100%",
          maxWidth: MAX_APP_WIDTH,
          alignSelf: "center",
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
          backgroundColor: palette.background,
          borderTopColor: palette.line
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 2
        },
        tabBarItemStyle: {
          minHeight: 46,
          paddingVertical: 3
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          lineHeight: 14,
          letterSpacing: 0
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarIcon: ({ focused }) => <TabGlyph kind="home" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "카메라",
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ focused }) => <TabGlyph kind="camera" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: isLoggedIn ? "마이페이지" : "로그인",
          tabBarIcon: ({ focused }) => <TabGlyph kind="account" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "편집",
          tabBarIcon: ({ focused }) => <TabGlyph kind="studio" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ focused }) => <TabGlyph kind="settings" focused={focused} />
        }}
      />
    </Tabs>
  );
}
