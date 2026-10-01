import { View } from "react-native";

import { AdPrivacyOptions } from "@/components/ad-privacy-options";
import BodyFrameSettingsScreen from "@/features/settings/BodyFrameSettingsScreen";

export default function BodyFrameSettingsWithPrivacyScreen() {
  return (
    <View style={{ flex: 1 }}>
      <BodyFrameSettingsScreen />
      <AdPrivacyOptions />
    </View>
  );
}
