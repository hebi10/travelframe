import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideCard } from "@/components/app-guide-card";
import { AppGuideHighlight } from "@/components/app-guide-highlight";
import type { AppGuideTabKey } from "@/constants/app-guide-steps";
import { useAppGuide } from "@/hooks/use-app-guide";

const guideVisualSlides = [
  require("@/assets/images/home-slide-camera.png"),
  require("@/assets/images/home-slide-edit.png"),
  require("@/assets/images/home-slide-video.png")
];

const initialGuideVisualIndex: Record<AppGuideTabKey, number> = {
  home: 0,
  camera: 0,
  studio: 1,
  tripClip: 2,
  account: 2,
  settings: 1
};

type AppGuideOverlayProps = {
  tabKey: AppGuideTabKey;
  transparentBackdrop?: boolean;
  replaySignal?: number;
};

export function AppGuideOverlay({
  tabKey,
  transparentBackdrop = false,
  replaySignal = 0
}: AppGuideOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visualScrollerRef = useRef<ScrollView>(null);
  const [activeVisualIndex, setActiveVisualIndex] = useState(
    initialGuideVisualIndex[tabKey]
  );
  const stageWidth = Math.min(width - 36, 750);
  const visualWidth = Math.max(1, stageWidth - 36);
  const {
    visible,
    step,
    stepIndex,
    totalSteps,
    canGoBack,
    goBack,
    goNext,
    skip
  } = useAppGuide(tabKey, replaySignal);

  useEffect(() => {
    const nextIndex = initialGuideVisualIndex[tabKey];
    setActiveVisualIndex(nextIndex);
    requestAnimationFrame(() => {
      visualScrollerRef.current?.scrollTo({
        x: nextIndex * visualWidth,
        animated: false
      });
    });
  }, [tabKey, visualWidth, visible]);

  if (!step) {
    return null;
  }

  const handleVisualScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / visualWidth);
    setActiveVisualIndex(
      Math.max(0, Math.min(guideVisualSlides.length - 1, nextIndex))
    );
  };

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
        <View style={[styles.content, { maxWidth: stageWidth }]}>
          <View style={styles.stage}>
            <View style={styles.visualArea}>
              <ScrollView
                ref={visualScrollerRef}
                horizontal
                pagingEnabled
                disableIntervalMomentum
                showsHorizontalScrollIndicator={false}
                snapToInterval={visualWidth}
                snapToAlignment="start"
                decelerationRate="fast"
                onMomentumScrollEnd={handleVisualScroll}
                style={styles.visualScroller}
                contentContainerStyle={styles.visualTrack}
              >
                {guideVisualSlides.map((visualSource, index) => (
                  <View
                    key={index}
                    style={[styles.visualSlide, { width: visualWidth }]}
                  >
                    <Image
                      source={visualSource}
                      style={styles.stageImage}
                      contentFit="contain"
                    />
                  </View>
                ))}
              </ScrollView>
              <View pointerEvents="none" style={styles.visualDots}>
                {guideVisualSlides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.visualDot,
                      activeVisualIndex === index && styles.visualDotActive
                    ]}
                  />
                ))}
              </View>
            </View>
            <View pointerEvents="none" style={styles.stageWash} />
            <View style={styles.stageTop}>
              <AppGuideHighlight label={step.targetLabel} />
            </View>
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
    alignSelf: "center",
    justifyContent: "center"
  },
  stage: {
    width: "100%",
    height: "78%",
    maxHeight: 680,
    minHeight: 520,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#F3F1EA"
  },
  visualArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10
  },
  visualScroller: {
    width: "100%",
    height: "100%"
  },
  visualTrack: {
    alignItems: "center"
  },
  visualSlide: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  visualDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    minHeight: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  visualDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "transparent"
  },
  visualDotActive: {
    backgroundColor: "#111111"
  },
  stageWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.04)"
  },
  stageImage: {
    width: "100%",
    height: "100%",
    maxWidth: 430,
    aspectRatio: 2 / 3
  },
  stageTop: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    alignItems: "flex-start"
  }
});
