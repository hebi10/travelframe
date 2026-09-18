export type BodyFrameProgressPlanTier =
  | "guest"
  | "free"
  | "ad_remove"
  | "pro"
  | "expert";

const normalizePhotoLimit = (value: number | null | undefined) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value > 0
    ? value
    : null;

const normalizeVideoLimit = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

const normalizePhotoCount = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const normalizeDuration = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0;

export const getBodyFrameCaptureLimitState = ({
  photoCount,
  maxProgressPhotos
}: {
  photoCount: number;
  maxProgressPhotos: number | null | undefined;
}) => {
  const count = normalizePhotoCount(photoCount);
  const limit = normalizePhotoLimit(maxProgressPhotos);

  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      remaining: null,
      reached: false
    };
  }

  const remaining = Math.max(0, limit - count);
  return {
    allowed: count < limit,
    limit,
    remaining,
    reached: count >= limit
  };
};

export const getBodyFrameVideoLimitState = ({
  durationSeconds,
  maxProgressVideoSeconds
}: {
  durationSeconds: number;
  maxProgressVideoSeconds: number | null | undefined;
}) => {
  const duration = normalizeDuration(durationSeconds);
  const limit = normalizeVideoLimit(maxProgressVideoSeconds);

  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      remainingSeconds: null,
      exceededBySeconds: 0
    };
  }

  const allowed = duration <= limit + Number.EPSILON;
  return {
    allowed,
    limit,
    remainingSeconds: Number(Math.max(0, limit - duration).toFixed(1)),
    exceededBySeconds: Number(Math.max(0, duration - limit).toFixed(1))
  };
};

export const isBodyFrameProjectTargetAllowed = ({
  targetPhotoCount,
  maxProgressPhotos
}: {
  targetPhotoCount: number;
  maxProgressPhotos: number | null | undefined;
}) => {
  const target =
    Number.isFinite(targetPhotoCount) && targetPhotoCount > 0
      ? Math.floor(targetPhotoCount)
      : 0;
  const limit = normalizePhotoLimit(maxProgressPhotos);

  return target > 0 && (limit === null || target <= limit);
};

export const getBodyFrameUpgradePlan = (
  tier: BodyFrameProgressPlanTier
): "pro" | "expert" | null => {
  if (tier === "expert") {
    return null;
  }

  if (tier === "pro") {
    return "expert";
  }

  return "pro";
};

export const getBodyFrameUpgradeLabel = (
  tier: BodyFrameProgressPlanTier
): "Pro" | "Expert" | null => {
  const nextPlan = getBodyFrameUpgradePlan(tier);
  if (nextPlan === "pro") {
    return "Pro";
  }
  if (nextPlan === "expert") {
    return "Expert";
  }
  return null;
};
