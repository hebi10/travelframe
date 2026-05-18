import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideCard } from "@/components/app-guide-card";
import { AppGuideHighlight } from "@/components/app-guide-highlight";
import type { AppGuideTabKey } from "@/constants/app-guide-steps";
import { useAppGuide } from "@/hooks/use-app-guide";

type AppGuideOverlayProps = {
  tabKey: AppGuideTabKey;
  transparentBackdrop?: boolean;
};

export function AppGuideOverlay({
  tabKey,
  transparentBackdrop = false
}: AppGuideOverlayProps) {
  const insets = useSafeAreaInsets();
  const {
    visible,
    step,
    stepIndex,
    totalSteps,
    canGoBack,
    goBack,
    goNext,
    skip
  } = useAppGuide(tabKey);

  if (!step) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={skip}
    >
      <View
        style={[
          styles.backdrop,
          transparentBackdrop ? styles.clearBackdrop : styles.dimBackdrop,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: Math.max(insets.bottom + 16, 24)
          }
        ]}
      >
        <View
          style={[
            styles.content,
            step.placement === "top" && styles.contentTop,
            step.placement === "center" && styles.contentCenter,
            step.placement === "bottom" && styles.contentBottom
          ]}
        >
          <AppGuideHighlight label={step.targetLabel} />
          <AppGuideCard
            step={step}
            current={stepIndex + 1}
            total={totalSteps}
            canGoBack={canGoBack}
            onBack={goBack}
            onNext={goNext}
            onSkip={skip}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingHorizontal: 18
  },
  dimBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.28)"
  },
  clearBackdrop: {
    backgroundColor: "transparent"
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 750,
    alignSelf: "center",
    gap: 10
  },
  contentTop: {
    justifyContent: "flex-start"
  },
  contentCenter: {
    justifyContent: "center"
  },
  contentBottom: {
    justifyContent: "flex-end"
  }
});
