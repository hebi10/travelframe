import { Feather } from "@expo/vector-icons";
import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/constants/app-theme";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import type { TripClipDraft } from "@/lib/trip-clip-draft";

type TripClipHeaderProps = {
  handleBackPress: () => void;
  isLoading: boolean;
  isExporting: boolean;
  handleHeaderSavePress: () => void;
  isEditingMadeVideo: boolean;
  availableDraft: TripClipDraft | null;
  showDraftPrompt: boolean;
  formatDraftTime: (value: string) => string;
  resumeTripClipDraft: () => void;
  removeTripClipDraft: () => void | Promise<void>;
  workTitle: string;
  setWorkTitle: Dispatch<SetStateAction<string>>;
};

export function TripClipHeader({
  handleBackPress,
  isLoading,
  isExporting,
  handleHeaderSavePress,
  isEditingMadeVideo,
  availableDraft,
  showDraftPrompt,
  formatDraftTime,
  resumeTripClipDraft,
  removeTripClipDraft,
  workTitle,
  setWorkTitle
}: TripClipHeaderProps) {
  return (
      <View style={styles.header}>
        <View style={styles.headerActionRow}>
          <Pressable
            style={styles.headerBackButton}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="보관함으로 돌아가기"
          >
            <Feather name="chevron-left" size={21} color={colors.text} />
            <Text selectable={false} style={styles.headerBackButtonText}>
              뒤로
            </Text>
          </Pressable>
          <View style={styles.headerSpacer} />
          <Pressable
            disabled={isLoading || isExporting}
            style={[
              styles.draftSaveButton,
              (isLoading || isExporting) && styles.disabledButton
            ]}
            onPress={handleHeaderSavePress}
          >
            <Text selectable={false} style={styles.draftSaveButtonText}>
              {isEditingMadeVideo ? "저장" : "임시 저장"}
            </Text>
          </Pressable>
        </View>
        <Text selectable style={styles.eyebrow}>
          영상 만들기
        </Text>
        <Text selectable style={styles.title}>
          동영상
        </Text>
        <Text selectable style={styles.description}>
          사진을 고르고 순서를 정한 뒤 템플릿과 음악을 적용해 앱 안에서 영상처럼 재생합니다.
        </Text>
        {availableDraft && showDraftPrompt ? (
          <View style={styles.draftPanel}>
            <View style={styles.draftCopy}>
              <Text selectable style={styles.draftTitle}>
                임시 저장된 영상 만들기 작업이 있습니다
              </Text>
              <Text selectable style={styles.draftDetail}>
                {formatDraftTime(availableDraft.updatedAt)} 작업 상태에서 이어서 편집할 수 있습니다.
              </Text>
            </View>
            <View style={styles.draftActions}>
              <Pressable style={styles.draftButton} onPress={resumeTripClipDraft}>
                <Text selectable={false} style={styles.draftButtonText}>
                  이어서 작업하기
                </Text>
              </Pressable>
              <Pressable style={styles.draftGhostButton} onPress={removeTripClipDraft}>
                <Text selectable={false} style={styles.draftGhostButtonText}>
                  삭제
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.workTitlePanel}>
          <Text selectable style={styles.settingLabel}>
            작업 이름
          </Text>
          <TextInput
            value={workTitle}
            placeholder="영상 만들기 이름"
            placeholderTextColor={colors.faint}
            style={styles.workTitleInput}
            onChangeText={setWorkTitle}
          />
        </View>
      </View>


  );
}
