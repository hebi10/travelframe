import { localStorageAdapter } from "@/lib/local-storage";
import {
  defaultBodyPoseAlignmentSettings,
  type BodyPoseAlignmentSettings,
  type BodyPoseGuidance,
  type BodyPoseMetrics
} from "@/types/body-pose-alignment";

export const BODY_POSE_ALIGNMENT_STORAGE_KEY = [
  "body",
  "frame",
  "pose",
  "alignment",
  "v1"
].join(".");

const normalizeSettings = (value: unknown): BodyPoseAlignmentSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultBodyPoseAlignmentSettings;
  }

  return {
    enabled: (value as Record<string, unknown>).enabled === true
  };
};

const readSettingsMap = async () => {
  const raw = await localStorageAdapter.getItem(BODY_POSE_ALIGNMENT_STORAGE_KEY);
  if (!raw) return {} as Record<string, BodyPoseAlignmentSettings>;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([projectId, value]) => [
        projectId,
        normalizeSettings(value)
      ])
    );
  } catch {
    return {};
  }
};

export const getBodyPoseAlignmentSettings = async (projectId: string) => {
  const map = await readSettingsMap();
  return map[projectId] ?? defaultBodyPoseAlignmentSettings;
};

export const updateBodyPoseAlignmentSettings = async (
  projectId: string,
  enabled: boolean
) => {
  const map = await readSettingsMap();
  const next: BodyPoseAlignmentSettings = { enabled };
  await localStorageAdapter.setItem(
    BODY_POSE_ALIGNMENT_STORAGE_KEY,
    JSON.stringify({ ...map, [projectId]: next })
  );
  return next;
};

const confidenceThreshold = 0.55;
const horizontalThreshold = 0.045;
const scaleThreshold = 0.1;
const shoulderTiltThreshold = 6;

export const getBodyPoseGuidance = ({
  reference,
  current,
  mirrorHorizontal = false
}: {
  reference: BodyPoseMetrics | null;
  current: BodyPoseMetrics | null;
  mirrorHorizontal?: boolean;
}): BodyPoseGuidance => {
  if (!reference?.detected || reference.confidence < confidenceThreshold) {
    return {
      status: "reference_unavailable",
      message: "기준 사진에서 자세를 확인할 수 없습니다.",
      aligned: false
    };
  }

  if (!current?.detected || current.confidence < confidenceThreshold) {
    return {
      status: "no_pose",
      message: "전신이 보이도록 카메라 앞에 서주세요.",
      aligned: false
    };
  }

  const horizontalDelta = current.centerX - reference.centerX;
  if (Math.abs(horizontalDelta) > horizontalThreshold) {
    const shouldMoveLeft = mirrorHorizontal
      ? horizontalDelta < 0
      : horizontalDelta > 0;

    return {
      status: shouldMoveLeft ? "move_left" : "move_right",
      message: shouldMoveLeft ? "왼쪽으로 조금 이동하세요." : "오른쪽으로 조금 이동하세요.",
      aligned: false
    };
  }

  const referenceScale =
    reference.bodyHeight > 0 ? reference.bodyHeight : reference.shoulderWidth;
  const currentScale =
    current.bodyHeight > 0 ? current.bodyHeight : current.shoulderWidth;

  if (referenceScale > 0 && currentScale > 0) {
    const scaleRatio = currentScale / referenceScale;
    if (scaleRatio < 1 - scaleThreshold) {
      return {
        status: "move_closer",
        message: "카메라에 조금 더 가까이 와주세요.",
        aligned: false
      };
    }
    if (scaleRatio > 1 + scaleThreshold) {
      return {
        status: "move_farther",
        message: "카메라에서 조금 더 멀어져 주세요.",
        aligned: false
      };
    }
  }

  if (
    Math.abs(current.shoulderTiltDegrees - reference.shoulderTiltDegrees) >
    shoulderTiltThreshold
  ) {
    return {
      status: "level_shoulders",
      message: "어깨 높이를 기준 사진과 맞춰주세요.",
      aligned: false
    };
  }

  return {
    status: "aligned",
    message: "위치가 맞았습니다.",
    aligned: true
  };
};

export const BODY_POSE_ANALYSIS_INTERVAL_MS = 1200;
