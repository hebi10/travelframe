export type BodyPoseAlignmentSettings = {
  enabled: boolean;
};

export type BodyPoseMetrics = {
  detected: boolean;
  fullBodyDetected: boolean;
  confidence: number;
  centerX: number;
  centerY: number;
  bodyHeight: number;
  shoulderWidth: number;
  shoulderTiltDegrees: number;
};

export type BodyPoseGuidanceStatus =
  | "idle"
  | "analyzing"
  | "no_pose"
  | "reference_unavailable"
  | "move_left"
  | "move_right"
  | "move_closer"
  | "move_farther"
  | "level_shoulders"
  | "aligned";

export type BodyPoseGuidance = {
  status: BodyPoseGuidanceStatus;
  message: string;
  aligned: boolean;
};

export const defaultBodyPoseAlignmentSettings: BodyPoseAlignmentSettings = {
  enabled: false
};
