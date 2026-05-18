import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { colors, typography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

const HOME_SLIDE_IMAGE_ASPECT_RATIO = 2 / 3;

const homeSlides: {
  image: number;
  href: Href;
  label: string;
  detail: string;
}[] = [
  {
    image: require("../../assets/images/home-slide-camera.png"),
    href: "/camera",
    label: "카메라 열기",
    detail: "중앙 가이드와 이전 사진 오버레이로 같은 구도를 맞춰 촬영합니다."
  },
  {
    image: require("../../assets/images/home-slide-edit.png"),
    href: "/studio",
    label: "사진 편집",
    detail: "촬영한 사진의 비율, 위치, 회전을 정리하고 저장합니다."
  },
  {
    image: require("../../assets/images/home-slide-video.png"),
    href: "/trip-clip",
    label: "영상 만들기",
    detail: "여러 사진의 순서와 전환을 정해 짧은 영상으로 저장합니다."
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useAppAppearance();
  const { width } = useWindowDimensions();
  const scrollerRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const slideWidth = Math.min(width - 44, 360);
  const isDark = palette.background !== colors.background;
  const filledButtonStyle = {
    borderColor: palette.text,
    backgroundColor: isDark ? "transparent" : palette.text
  };
  const filledButtonTextStyle = {
    color: isDark ? palette.text : palette.inverse
  };

  const handleSlideScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveSlide(Math.max(0, Math.min(homeSlides.length - 1, nextIndex)));
  };

  const moveSlide = (direction: -1 | 1) => {
    const nextIndex =
      (activeSlide + direction + homeSlides.length) % homeSlides.length;
    scrollerRef.current?.scrollTo({
      x: nextIndex * slideWidth,
      animated: true
    });
    setActiveSlide(nextIndex);
  };

  return (
    <ScreenShell
      eyebrow="트래블프레임"
      title="여행 사진을 깔끔하게."
      description="같은 구도로 촬영하고, 사진과 짧은 여행 클립까지 정리합니다."
      safeTop
    >
      <View style={[styles.preview, { width: slideWidth }]}>
        <ScrollView
          ref={scrollerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={slideWidth}
          decelerationRate="fast"
          onMomentumScrollEnd={handleSlideScroll}
          style={[
            styles.heroScroller,
            { borderColor: palette.text, backgroundColor: palette.background }
          ]}
          contentContainerStyle={styles.heroTrack}
        >
          {homeSlides.map((slide) => (
            <Pressable
              key={slide.label}
              accessibilityRole="button"
              accessibilityLabel={`${slide.label} 화면으로 이동`}
              style={({ pressed }) => [
                styles.heroSlide,
                { width: slideWidth },
                { backgroundColor: palette.background },
                pressed && styles.heroPressed
              ]}
              onPress={() => router.push(slide.href)}
            >
              <Image
                source={slide.image}
                style={[styles.heroImage, { backgroundColor: palette.surface }]}
                contentFit="contain"
              />
              <View style={[styles.heroCopy, { borderTopColor: palette.line }]}>
                <View style={styles.heroCopyHeader}>
                  <Text selectable style={[styles.heroLabel, { color: palette.text }]}>
                    {slide.label}
                  </Text>
                  <Text
                    selectable={false}
                    style={[
                      styles.heroArrow,
                      filledButtonStyle,
                      filledButtonTextStyle
                    ]}
                  >
                    이동
                  </Text>
                </View>
                <Text selectable style={[styles.heroDetail, { color: palette.muted }]}>
                  {slide.detail}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sliderControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 슬라이드"
            style={[
              styles.sliderButton,
              { borderColor: palette.text, backgroundColor: palette.background }
            ]}
            onPress={() => moveSlide(-1)}
          >
            <Text selectable={false} style={[styles.sliderButtonText, { color: palette.text }]}>
              ‹
            </Text>
          </Pressable>
          <View style={styles.heroDots} pointerEvents="none">
            {homeSlides.map((slide, index) => (
              <View
                key={slide.label}
                style={[
                  styles.heroDot,
                  { borderColor: palette.text },
                  activeSlide === index && {
                    backgroundColor: isDark ? "transparent" : palette.text
                  }
                ]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 슬라이드"
            style={[
              styles.sliderButton,
              { borderColor: palette.text, backgroundColor: palette.background }
            ]}
            onPress={() => moveSlide(1)}
          >
            <Text selectable={false} style={[styles.sliderButtonText, { color: palette.text }]}>
              ›
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: "center",
    alignSelf: "center",
    paddingTop: 4,
    paddingBottom: 18
  },
  heroScroller: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: colors.background
  },
  heroTrack: {
    alignItems: "center"
  },
  heroSlide: {
    backgroundColor: colors.background
  },
  heroPressed: {
    opacity: 0.9
  },
  heroImage: {
    width: "100%",
    aspectRatio: HOME_SLIDE_IMAGE_ASPECT_RATIO,
    backgroundColor: "#F5F5F2"
  },
  heroCopy: {
    gap: 8,
    paddingTop: 18,
    paddingBottom: 26,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  heroCopyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  heroLabel: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: 0
  },
  heroArrow: {
    minWidth: 48,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.inverse,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center",
    letterSpacing: 0,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  heroDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  sliderControls: {
    width: "100%",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 12
  },
  sliderButton: {
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  sliderButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: 0
  },
  heroDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: "transparent"
  },
  heroDotActive: {
    width: 8,
    backgroundColor: colors.text
  }
});

