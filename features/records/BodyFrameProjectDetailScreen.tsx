import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getBodyProjectPhotos,
  getBodyProjectProgressSummary
} from "@/lib/body-frame-camera-project";
import {
  archiveBodyProject,
  getBodyProjectById,
  updateBodyProject
} from "@/lib/body-project-library";
import { setLastActiveProjectId } from "@/lib/body-project-preferences";
import {
  getBodyFrameUpgradeLabel,
  isBodyFrameProjectTargetAllowed
} from "@/lib/body-frame-plan-limits";
import { getPhotos } from "@/lib/photo-library";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import type { BodyProject, ReferencePhotoMode } from "@/types/body-project";
import type { PhotoItem } from "@/types/photo";

const getCover = (project: BodyProject, photos: PhotoItem[]) => {
  const projectPhotos = getBodyProjectPhotos(photos, project.id);
  if (project.coverPhotoId) {
    const explicit = projectPhotos.find((photo) => photo.id === project.coverPhotoId);
    if (explicit) return explicit;
  }

  return [...projectPhotos].sort(
    (first, second) => (second.sequence ?? 0) - (first.sequence ?? 0)
  )[0] ?? null;
};

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds.toFixed(1)}초`
    : `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;

export default function BodyFrameProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const { isLoggedIn, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const upgradePlanLabel = getBodyFrameUpgradeLabel(planEntitlements.tier);
  const [project, setProject] = useState<BodyProject | null | undefined>(undefined);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      return;
    }

    const [storedProject, storedPhotos] = await Promise.all([
      getBodyProjectById(projectId),
      getPhotos()
    ]);

    setProject(storedProject);
    setPhotos(storedPhotos);
    if (storedProject) {
      setNameDraft(storedProject.name);
      setTargetDraft(String(storedProject.targetPhotoCount));
      await setLastActiveProjectId(storedProject.id);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const summary = useMemo(
    () => (project ? getBodyProjectProgressSummary(photos, project) : null),
    [photos, project]
  );
  const cover = useMemo(
    () => (project ? getCover(project, photos) : null),
    [photos, project]
  );

  const saveBasicInfo = useCallback(async () => {
    if (!project || saving) return;

    const target = Number.parseInt(targetDraft, 10);
    if (!nameDraft.trim()) {
      Alert.alert("프로젝트 이름", "프로젝트 이름을 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(target) || target <= 0) {
      Alert.alert("목표 기록 수", "1 이상의 숫자를 입력해 주세요.");
      return;
    }

    if (
      target !== project.targetPhotoCount &&
      !isBodyFrameProjectTargetAllowed({
        targetPhotoCount: target,
        maxProgressPhotos: planEntitlements.maxProgressPhotos
      })
    ) {
      Alert.alert(
        "현재 플랜 한도",
        `${planEntitlements.label} 플랜에서는 프로젝트 목표를 최대 ${planEntitlements.maxProgressPhotos}장까지 설정할 수 있습니다.`
      );
      return;
    }

    setSaving(true);
    try {
      await updateBodyProject(project.id, {
        name: nameDraft.trim(),
        targetPhotoCount: target
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }, [
    nameDraft,
    planEntitlements.label,
    planEntitlements.maxProgressPhotos,
    project,
    reload,
    saving,
    targetDraft
  ]);

  const changeReferenceMode = useCallback(
    async (referenceMode: ReferencePhotoMode) => {
      if (!project || saving || project.referenceMode === referenceMode) return;
      setSaving(true);
      try {
        await updateBodyProject(project.id, { referenceMode });
        await reload();
      } finally {
        setSaving(false);
      }
    },
    [project, reload, saving]
  );

  const confirmArchive = useCallback(() => {
    if (!project) return;

    Alert.alert(
      "프로젝트 보관",
      `"${project.name}" 프로젝트를 보관하시겠습니까? 사진 파일은 삭제되지 않습니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "보관",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await archiveBodyProject(project.id, true);
              router.back();
            })();
          }
        }
      ]
    );
  }, [project]);

  if (project === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.text} />
      </View>
    );
  }

  if (!project || !summary) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          프로젝트를 찾을 수 없습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: palette.line }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            돌아가기
          </Text>
        </Pressable>
      </View>
    );
  }

  const progress = Math.min(
    1,
    summary.photoCount / Math.max(1, summary.targetPhotoCount)
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            style={[styles.backButton, { borderColor: palette.line }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: palette.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.pageTitle, { color: palette.text }]}>프로젝트 상세</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.hero}>
          <View
            style={[
              styles.coverFrame,
              {
                backgroundColor: palette.surface,
                borderColor: palette.line
              }
            ]}
          >
            {cover ? (
              <Image
                source={{ uri: cover.previewUri ?? cover.uri }}
                style={styles.coverImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.coverEmpty}>
                <Text style={[styles.coverEmptyText, { color: palette.faint }]}>
                  첫 기록 전
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroCopy}>
            <Text style={[styles.projectName, { color: palette.text }]}>
              {project.name}
            </Text>
            <Text style={[styles.projectMeta, { color: palette.muted }]}>
              {summary.photoCount} / {summary.targetPhotoCount}장
            </Text>
            <Text style={[styles.projectMeta, { color: palette.muted }]}>
              변화 영상 {formatDuration(summary.durationSeconds)}
            </Text>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: palette.surfaceStrong }
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: palette.text
                  }
                ]}
              />
            </View>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            프로젝트 정보
          </Text>
          <Text style={[styles.label, { color: palette.muted }]}>이름</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="프로젝트 이름"
            placeholderTextColor={palette.faint}
            style={[
              styles.input,
              {
                color: palette.text,
                borderColor: palette.line,
                backgroundColor: palette.background
              }
            ]}
          />
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: palette.muted }]}>목표 기록 수</Text>
            <Text style={[styles.limitLabel, { color: palette.faint }]}>
              {planEntitlements.maxProgressPhotos === null
                ? "제한 없음"
                : `현재 플랜 최대 ${planEntitlements.maxProgressPhotos}장`}
            </Text>
          </View>
          <TextInput
            value={targetDraft}
            onChangeText={setTargetDraft}
            keyboardType="number-pad"
            placeholder="100"
            placeholderTextColor={palette.faint}
            style={[
              styles.input,
              {
                color: palette.text,
                borderColor: palette.line,
                backgroundColor: palette.background
              }
            ]}
          />
          {planEntitlements.maxProgressPhotos !== null &&
          Number.parseInt(targetDraft, 10) !== project.targetPhotoCount &&
          Number.parseInt(targetDraft, 10) > planEntitlements.maxProgressPhotos &&
          upgradePlanLabel ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.upgradeButton, { borderColor: palette.line }]}
              onPress={() => router.push("/account")}
            >
              <Text style={[styles.upgradeButtonText, { color: palette.text }]}>
                플랜 보기 · {upgradePlanLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={saving}
            accessibilityRole="button"
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.text,
                opacity: saving ? 0.5 : 1
              }
            ]}
            onPress={() => void saveBasicInfo()}
          >
            <Text style={[styles.primaryButtonText, { color: palette.inverse }]}>
              변경 저장
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            기준 사진
          </Text>
          <Text style={[styles.sectionDetail, { color: palette.muted }]}>
            촬영 화면에서 몸을 맞출 반투명 기준 사진을 선택합니다.
          </Text>
          <View style={styles.choiceRow}>
            {([
              ["latest", "최근 사진"],
              ["first", "첫 사진"]
            ] as const).map(([mode, label]) => {
              const active = project.referenceMode === mode;
              return (
                <Pressable
                  key={mode}
                  disabled={saving}
                  accessibilityRole="button"
                  onPress={() => void changeReferenceMode(mode)}
                  style={[
                    styles.choiceButton,
                    {
                      borderColor: active ? palette.text : palette.line,
                      backgroundColor: active ? palette.text : palette.background
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      { color: active ? palette.inverse : palette.text }
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.dangerSection,
            {
              borderColor: palette.line
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>프로젝트 관리</Text>
          <Text style={[styles.sectionDetail, { color: palette.muted }]}>
            보관하면 기록 탭과 촬영 프로젝트 선택 목록에서 숨겨집니다. 사진 파일은 유지됩니다.
          </Text>
          <Pressable
            disabled={saving}
            accessibilityRole="button"
            style={[styles.archiveButton, { borderColor: palette.line }]}
            onPress={confirmArchive}
          >
            <Text style={[styles.archiveText, { color: palette.text }]}>
              프로젝트 보관
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingHorizontal: 16
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24
  },
  topBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8
  },
  backButtonText: {
    marginTop: -2,
    fontSize: 28,
    fontWeight: "400"
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600"
  },
  topSpacer: {
    width: 44
  },
  hero: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 24
  },
  coverFrame: {
    width: 104,
    aspectRatio: 9 / 16,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 8
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  coverEmptyText: {
    fontSize: 12
  },
  heroCopy: {
    flex: 1,
    gap: 8
  },
  projectName: {
    fontSize: 22,
    fontWeight: "600"
  },
  projectMeta: {
    fontSize: 14
  },
  progressTrack: {
    height: 5,
    marginTop: 4,
    overflow: "hidden",
    borderRadius: 3
  },
  progressFill: {
    height: "100%",
    borderRadius: 3
  },
  section: {
    gap: 10,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8
  },
  dangerSection: {
    gap: 10,
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600"
  },
  sectionDetail: {
    fontSize: 13,
    lineHeight: 19
  },
  labelRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  label: {
    fontSize: 12
  },
  limitLabel: {
    fontSize: 11
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 15
  },
  upgradeButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8
  },
  upgradeButtonText: {
    fontSize: 13,
    fontWeight: "600"
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginTop: 4
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600"
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8
  },
  choiceButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8
  },
  choiceText: {
    fontSize: 13,
    fontWeight: "600"
  },
  archiveButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8
  },
  archiveText: {
    fontSize: 14,
    fontWeight: "600"
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600"
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600"
  }
});
