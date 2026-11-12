import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabGlyph } from "@/components/tab-glyph";
import { bodyFrameDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";


export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale: systemFontScale } = useWindowDimensions();
  const { palette, fontSizeScale, layoutScale, emphasisWeight, fontFamily } = useAppAppearance();
  const { selected: activeTabColor, unselected: inactiveTabColor } = getBodyFrameControlColors(palette);
  const tabBarBottomPadding = Math.max(insets.bottom + 8, 16);
  const tabLabelLineHeight = 16;
  const extraFontHeight = Math.max(0, Math.ceil(tabLabelLineHeight * fontSizeScale * systemFontScale) - tabLabelLineHeight);
  const tabBarHeight = 58 + tabBarBottomPadding + extraFontHeight;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.chrome },
        headerTintColor: palette.text,
        tabBarActiveTintColor: activeTabColor,
        tabBarInactiveTintColor: inactiveTabColor,
        tabBarStyle: {
          height: tabBarHeight,
          width: "100%",
          maxWidth: bodyFrameDesign.contentMaxWidth,
          alignSelf: "center",
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
          backgroundColor: palette.chrome
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 1
        },
        tabBarItemStyle: {
          minHeight: bodyFrameDesign.minTouchSize + extraFontHeight,
          paddingVertical: Math.round(2 * layoutScale)
        },
        tabBarLabelStyle: {
          fontSize: Math.round(bodyFrameTypography.caption * fontSizeScale),
          fontFamily,
          fontWeight: emphasisWeight,
          lineHeight: Math.round(tabLabelLineHeight * fontSizeScale),
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
