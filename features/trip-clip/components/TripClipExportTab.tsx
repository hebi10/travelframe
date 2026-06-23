import type { Dispatch, SetStateAction } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { DEFAULT_IMAGE_QUALITY, IMAGE_QUALITY_DESCRIPTION, IMAGE_QUALITY_OPTIONS, type ImageQuality } from "@/constants/image";
import { VIDEO_QUALITY_DESCRIPTION, VIDEO_QUALITY_OPTIONS, type VideoQualityId } from "@/constants/video";
import { Chip, OptionRow, Section } from "@/features/trip-clip/trip-clip-screen.components";
import { IMAGE_SAVE_FORMAT_OPTIONS } from "@/features/trip-clip/trip-clip-screen.constants";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import type { ImageSaveFormat } from "@/lib/trip-clip-export";
import type { WeeklyVideoExportUsage } from "@/lib/video-export-quota";

type ExportFormat = "mp4" | "images";
type ExportFormatOption = {
  label: string;
  value: ExportFormat;
  detail: string;
};

type TripClipExportTabProps = {
  exportFormat: ExportFormat;
  exportFormatOptions: ExportFormatOption[];
  isLoggedIn: boolean;
  premiumExportActive: boolean;
  planLabel: string;
  canBackupToCloud: boolean;
  weeklyVideoExportLimit: number;
  weeklyVideoExportUsage: WeeklyVideoExportUsage | null;
  cloudBackupEnabled: boolean;
  updateTripClipExportFormat: (format: ExportFormat) => void;
  videoQuality: VideoQualityId;
  updateTripClipVideoQuality: (quality: VideoQualityId) => void;
  canBackupVideoExport: boolean;
  shouldBackupVideoExport: boolean;
  setShouldBackupVideoExport: Dispatch<SetStateAction<boolean>>;
  setExportMessage: (message: string | null) => void;
  videoBackupTargetEnabled: boolean;
  videoBackupRemaining: number;
  videoBackupLimit: number;
  imageQuality: ImageQuality;
  updateImageQuality: (quality: ImageQuality) => void;
  imageSaveFormat: ImageSaveFormat;
  updateTripClipImageSaveFormat: (format: ImageSaveFormat) => void;
  isExporting: boolean;
  selectedPhotoCount: number;
  videoDurationTooLong: boolean;
  saveSelectedExport: () => void | Promise<void>;
  shareSelectedExport: () => void | Promise<void>;
  exportMessage: string | null;
};

export function TripClipExportTab({
  exportFormat,
  exportFormatOptions,
  isLoggedIn,
  premiumExportActive,
  planLabel,
  canBackupToCloud,
  weeklyVideoExportLimit,
  weeklyVideoExportUsage,
  cloudBackupEnabled,
  updateTripClipExportFormat,
  videoQuality,
  updateTripClipVideoQuality,
  canBackupVideoExport,
  shouldBackupVideoExport,
  setShouldBackupVideoExport,
  setExportMessage,
  videoBackupTargetEnabled,
  videoBackupRemaining,
  videoBackupLimit,
  imageQuality,
  updateImageQuality,
  imageSaveFormat,
  updateTripClipImageSaveFormat,
  isExporting,
  selectedPhotoCount,
  videoDurationTooLong,
  saveSelectedExport,
  shareSelectedExport,
  exportMessage
}: TripClipExportTabProps) {
  void DEFAULT_IMAGE_QUALITY;
  return (
      <Section title="핸드폰에 저장">
        <View style={styles.exportPanel}>
          <Text selectable style={styles.exportDetail}>
            저장할 형식을 선택한 뒤 바로 핸드폰 앨범에 저장하거나 공유합니다.
          </Text>
          {exportFormat === "mp4" && !isLoggedIn ? (
            <Text selectable style={styles.exportNotice}>
              MP4 저장은 로그인 후 사용할 수 있습니다. 무료 로그인 사용자는 주 1개까지 만들 수 있습니다.
            </Text>
          ) : exportFormat === "mp4" && premiumExportActive ? (
            <Text selectable style={styles.exportNotice}>
              {planLabel} 이용 중입니다. MP4 영상을 주 {weeklyVideoExportLimit}회 저장하고 광고 없이 사용할 수 있습니다.
            </Text>
          ) : exportFormat === "mp4" ? (
            <Text selectable style={styles.exportNotice}>
              무료 MP4 저장은 주 1개까지 가능합니다.
              {weeklyVideoExportUsage
                ? ` 이번 주 남은 횟수는 ${weeklyVideoExportUsage.remaining}개입니다.`
                : " 저장 전 가능 횟수를 확인합니다."}
            </Text>
          ) : cloudBackupEnabled ? (
            <Text selectable style={styles.exportNotice}>
              클라우드 백업이 켜져 있어 저장한 작업물이 계정에도 백업됩니다.
            </Text>
          ) : (
            <Text selectable style={styles.exportNotice}>
              클라우드 백업은 설정에서 켤 수 있습니다. 꺼져 있으면 기기에만 저장됩니다.
            </Text>
          )}
          <View style={styles.exportFormatList}>
            {exportFormatOptions.map((option) => {
              const isActive = exportFormat === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.exportFormatOption, isActive && styles.exportFormatOptionActive]}
                  onPress={() => updateTripClipExportFormat(option.value)}
                >
                  <View style={styles.exportFormatCopy}>
                    <Text
                      selectable
                      style={[
                        styles.exportFormatTitle,
                        isActive && styles.exportFormatTitleActive
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      selectable
                      style={[
                        styles.exportFormatDetail,
                        isActive && styles.exportFormatDetailActive
                      ]}
                    >
                      {option.detail}
                    </Text>
                  </View>
                  <View style={[styles.exportFormatMark, isActive && styles.exportFormatMarkActive]} />
                </Pressable>
              );
            })}
          </View>
          {exportFormat === "mp4" ? (
            <>
              <View style={styles.imageFormatPanel}>
                <Text selectable style={styles.settingLabel}>
                  영상 화질
                </Text>
                <OptionRow>
                  {VIDEO_QUALITY_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      active={videoQuality === option.id}
                      onPress={() => updateTripClipVideoQuality(option.id)}
                    />
                  ))}
                </OptionRow>
                <Text selectable style={styles.settingDetail}>
                  {VIDEO_QUALITY_DESCRIPTION}
                </Text>
              </View>
              <Pressable
                disabled={!canBackupVideoExport}
                style={[
                  styles.videoBackupOption,
                  !canBackupVideoExport && styles.videoBackupOptionDisabled
                ]}
                onPress={() => {
                  setShouldBackupVideoExport((current) => !current);
                  setExportMessage(null);
                }}
              >
                <View
                  style={[
                    styles.videoBackupCheckbox,
                    shouldBackupVideoExport &&
                      canBackupVideoExport &&
                      styles.videoBackupCheckboxActive
                  ]}
                >
                  {shouldBackupVideoExport && canBackupVideoExport ? (
                    <Text selectable={false} style={styles.videoBackupCheckboxText}>
                      ✓
                    </Text>
                  ) : null}
                </View>
                <View style={styles.videoBackupCopy}>
                  <Text selectable style={styles.videoBackupTitle}>
                    클라우드 백업
                  </Text>
                  <Text selectable style={styles.videoBackupDetail}>
                    {cloudBackupEnabled && canBackupToCloud && videoBackupTargetEnabled
                      ? `체크한 영상만 백업합니다. 남은 영상 백업 ${videoBackupRemaining}개 / ${videoBackupLimit}개`
                      : "구독과 클라우드 백업 설정이 켜져 있을 때 사용할 수 있습니다."}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}
          {exportFormat === "images" ? (
            <View style={styles.imageFormatPanel}>
              <Text selectable style={styles.settingLabel}>
                이미지 화질
              </Text>
              <OptionRow>
                {IMAGE_QUALITY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={imageQuality === option.value}
                    onPress={() => updateImageQuality(option.value)}
                  />
                ))}
              </OptionRow>
              <Text selectable style={styles.settingDetail}>
                {IMAGE_QUALITY_DESCRIPTION}
              </Text>
              <Text selectable style={styles.settingLabel}>
                이미지 형식
              </Text>
              <View style={styles.imageFormatOptions}>
                {IMAGE_SAVE_FORMAT_OPTIONS.map((option) => {
                  const isActive = imageSaveFormat === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.imageFormatButton,
                        isActive && styles.imageFormatButtonActive
                      ]}
                      onPress={() => updateTripClipImageSaveFormat(option.value)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.imageFormatButtonText,
                          isActive && styles.imageFormatButtonTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text selectable style={styles.settingDetail}>
                {
                  IMAGE_SAVE_FORMAT_OPTIONS.find(
                    (option) => option.value === imageSaveFormat
                  )?.detail
                }
              </Text>
            </View>
          ) : null}
          <View style={styles.previewActions}>
            <Pressable
              android_disableSound
              disabled={isExporting || selectedPhotoCount === 0 || videoDurationTooLong}
              style={[
                styles.primaryButton,
                (isExporting || selectedPhotoCount === 0 || videoDurationTooLong) &&
                  styles.disabledButton
              ]}
              onPress={() => void saveSelectedExport()}
            >
              <Text selectable={false} style={styles.primaryButtonText}>
                {exportFormat === "mp4" && Platform.OS === "web"
                  ? "준비중"
                  : isExporting
                    ? "저장 중"
                    : exportFormat === "mp4"
                      ? "MP4 저장"
                      : "이미지 저장"}
              </Text>
            </Pressable>
            <Pressable
              android_disableSound
              disabled={
                isExporting ||
                selectedPhotoCount === 0 ||
                (exportFormat === "mp4" && videoDurationTooLong)
              }
              style={[
                styles.secondaryButton,
                (isExporting ||
                  selectedPhotoCount === 0 ||
                  (exportFormat === "mp4" && videoDurationTooLong)) &&
                  styles.disabledButton
              ]}
              onPress={shareSelectedExport}
            >
              <Text selectable={false} style={styles.secondaryButtonText}>
                공유
              </Text>
            </Pressable>
          </View>
          {exportMessage ? (
            <Text selectable style={styles.exportMessage}>
              {exportMessage}
            </Text>
          ) : null}
        </View>
      </Section>
  );
}
