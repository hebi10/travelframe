export const BODY_FRAME_DEFAULT_REFERENCE_MODE = "latest" as const;

export const BODY_FRAME_FREE_LIMITS = {
  maxProgressPhotos: 100,
  maxProgressVideoSeconds: null
} as const;

export const BODY_FRAME_PRO_MINIMUMS = {
  maxProgressPhotos: 365,
  maxProgressVideoSeconds: null
} as const;

export const BODY_FRAME_PROGRESS_POLICY = {
  secondsPerPhoto: 0.1,
  fps: 30,
  framesPerPhoto: 3
} as const;

export const BODY_FRAME_MEDIA_POLICY = {
  appImageMaxLongSide: 2560,
  appImageJpegQuality: 0.85,
  previewMaxLongSide: 1080,
  previewJpegQuality: 0.74
} as const;
