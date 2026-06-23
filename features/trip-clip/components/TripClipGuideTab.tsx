import { Pressable, Text, TextInput, View } from "react-native";

import { GUIDE_LABELS, GUIDE_TYPES, type GuideType } from "@/constants/camera-guides";
import { Chip, OptionRow, Section } from "@/features/trip-clip/trip-clip-screen.components";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import type { PhotoItem } from "@/types/photo";

type GuideSizeBounds = {
  min: number;
  max: number;
};

type TripClipGuideTabProps = {
  activePhoto: PhotoItem | null;
  previewGuideVisible: boolean;
  previewGuide: GuideType;
  previewGuideSize: number;
  previewGuideStrokeWidth: number;
  previewGuideSizeBounds: GuideSizeBounds;
  previewGuideSizeInput: string;
  previewGuideColor: string;
  isPreviewGuideMoving: boolean;
  guideSizeOptions: readonly { label: string; value: number }[];
  guideStrokeWidthOptions: readonly number[];
  guideColorOptions: readonly { label: string; value: string }[];
  updatePreviewGuideVisibility: (visible: boolean) => void;
  stopPreviewGuideMove: () => void;
  startPreviewGuideMove: () => void;
  resetPreviewGuidePositionToCenter: () => void;
  updatePreviewGuideType: (guide: GuideType) => void;
  applyPreviewGuideSize: (size: number) => void;
  setPreviewGuideSizeInput: (value: string) => void;
  commitPreviewGuideSizeInput: () => void;
  updatePreviewGuideStrokeWidth: (strokeWidth: number) => void;
  updatePreviewGuideColor: (color: string) => void;
};

export function TripClipGuideTab({
  activePhoto,
  previewGuideVisible,
  previewGuide,
  previewGuideSize,
  previewGuideStrokeWidth,
  previewGuideSizeBounds,
  previewGuideSizeInput,
  previewGuideColor,
  isPreviewGuideMoving,
  guideSizeOptions,
  guideStrokeWidthOptions,
  guideColorOptions,
  updatePreviewGuideVisibility,
  stopPreviewGuideMove,
  startPreviewGuideMove,
  resetPreviewGuidePositionToCenter,
  updatePreviewGuideType,
  applyPreviewGuideSize,
  setPreviewGuideSizeInput,
  commitPreviewGuideSizeInput,
  updatePreviewGuideStrokeWidth,
  updatePreviewGuideColor
}: TripClipGuideTabProps) {
  return (
      <Section title="가이드 설정">
        <View style={styles.guideSummaryPanel}>
          <View style={styles.guideSummaryCopy}>
            <Text selectable style={styles.settingDetail}>
              미리보기 사진 위에 카메라와 같은 구도 가이드를 표시합니다.
            </Text>
            <Text selectable style={styles.guideSummaryValue}>
              {previewGuideVisible ? "표시 중" : "숨김"} / {GUIDE_LABELS[previewGuide]} /{" "}
              {previewGuideSize} / {previewGuideStrokeWidth}px
            </Text>
          </View>
          <Pressable
            style={[
              styles.guideToggleButton,
              previewGuideVisible && styles.guideToggleButtonActive
            ]}
            onPress={() => updatePreviewGuideVisibility(!previewGuideVisible)}
          >
            <Text
              selectable={false}
              style={[
                styles.guideToggleButtonText,
                previewGuideVisible && styles.guideToggleButtonTextActive
              ]}
            >
              가이드 {previewGuideVisible ? "끄기" : "켜기"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.guideMoveActions}>
          <Pressable
            disabled={!activePhoto}
            style={[
              styles.guideMoveButton,
              isPreviewGuideMoving && styles.guideMoveButtonActive,
              !activePhoto && styles.disabledButton
            ]}
            onPress={isPreviewGuideMoving ? stopPreviewGuideMove : startPreviewGuideMove}
          >
            <Text
              selectable={false}
              style={[
                styles.guideMoveButtonText,
                isPreviewGuideMoving && styles.guideMoveButtonTextActive
              ]}
            >
              {isPreviewGuideMoving ? "이동 완료" : "드래그 이동하기"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.guideMoveButton}
            onPress={resetPreviewGuidePositionToCenter}
          >
            <Text selectable={false} style={styles.guideMoveButtonText}>
              중앙 이동
            </Text>
          </Pressable>
        </View>

        <Text selectable style={styles.settingLabel}>
          가이드라인
        </Text>
        <OptionRow>
          {GUIDE_TYPES.map((type) => (
            <Chip
              key={type}
              label={GUIDE_LABELS[type]}
              active={previewGuide === type}
              onPress={() => updatePreviewGuideType(type)}
            />
          ))}
        </OptionRow>

        <Text selectable style={styles.settingLabel}>
          크기
        </Text>
        <OptionRow>
          {guideSizeOptions.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={previewGuideSize === item.value}
              onPress={() => applyPreviewGuideSize(item.value)}
            />
          ))}
        </OptionRow>
        <View style={styles.guideSizeInputRow}>
          <Text selectable style={styles.settingDetail}>
            {previewGuideSizeBounds.min}-{previewGuideSizeBounds.max}
          </Text>
          <TextInput
            value={previewGuideSizeInput}
            keyboardType="number-pad"
            maxLength={String(previewGuideSizeBounds.max).length}
            selectTextOnFocus
            style={styles.guideSizeInput}
            onChangeText={(value) =>
              setPreviewGuideSizeInput(value.replace(/[^0-9]/g, ""))
            }
            onBlur={commitPreviewGuideSizeInput}
            onSubmitEditing={commitPreviewGuideSizeInput}
          />
        </View>

        <Text selectable style={styles.settingLabel}>
          선 두께
        </Text>
        <OptionRow>
          {guideStrokeWidthOptions.map((strokeWidth) => (
            <Chip
              key={strokeWidth}
              label={`${strokeWidth}px`}
              active={previewGuideStrokeWidth === strokeWidth}
              onPress={() => updatePreviewGuideStrokeWidth(strokeWidth)}
            />
          ))}
        </OptionRow>

        <Text selectable style={styles.settingLabel}>
          색상
        </Text>
        <View style={styles.guideColorRow}>
          {guideColorOptions.map((option) => {
            const isActive = previewGuideColor === option.value;

            return (
              <Pressable
                key={option.label}
                style={[styles.guideColorOption, isActive && styles.guideColorOptionActive]}
                onPress={() => updatePreviewGuideColor(option.value)}
              >
                <View
                  style={[
                    styles.guideColorSwatch,
                    { backgroundColor: option.value }
                  ]}
                />
                <Text selectable={false} style={styles.guideColorLabel}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
  );
}
