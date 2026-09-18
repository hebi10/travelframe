import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabGlyph } from "@/components/tab-glyph";
import { useAppAppearance } from "@/lib/app-appearance";

const MAX_APP_WIDTH = 750;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { palette, fontSizeScale, layoutScale, emphasisWeight, fontFamily } = useAppAppearance();
  const tabBarBottomPadding = Math.max(insets.bottom + 8, 16);
  const tabBarHeight = 58 + tabBarBottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.chrome },
        headerTintColor: palette.text,
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: palette.faint,
        tabBarStyle: {
          height: tabBarHeight,
          width: "100%",
          maxWidth: MAX_APP_WIDTH,
          alignSelf: "center",
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
          backgroundColor: palette.chrome,
          borderTopColor: palette.line,
          borderTopWidth: 1
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 1
        },
        tabBarItemStyle: {
          minHeight: 46,
          paddingVertical: Math.round(2 * layoutScale)
        },
        tabBarLabelStyle: {
          fontSize: Math.round(11 * fontSizeScale),
          fontFamily,
          fontWeight: emphasisWeight,
          lineHeight: Math.round(14 * fontSizeScale),
          letterSpacing: 0
        }
      }}
    >
      <Tabs.Screen
        name="camera"
        options={{
          title: "촬영",
          tabBarIcon: ({ focused }) => <TabGlyph kind="camera" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "기록",
          tabBarIcon: ({ focused }) => <TabGlyph kind="studio" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="trip-clip"
        options={{
          title: "영상",
          tabBarIcon: ({ focused }) => <TabGlyph kind="video" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "계정",
          href: null
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
