import { NativeModules, Platform } from "react-native";

import type { BodyPoseMetrics } from "@/types/body-pose-alignment";

type AndroidPoseAlignmentModule = {
  analyzePose(uri: string): Promise<BodyPoseMetrics>;
};

const nativeModule = NativeModules.AndroidPoseAlignment as
  | AndroidPoseAlignmentModule
  | undefined;

const normalizeFileUri = (uri: string) => {
  if (/^https?:\/\//i.test(uri)) {
    return null;
  }
  if (uri.startsWith("file://") || uri.startsWith("content://")) {
    return uri;
  }
  return `file://${uri}`;
};

export const canUseAndroidPoseAlignment = () =>
  Platform.OS === "android" && Boolean(nativeModule);

export const analyzeAndroidPose = async (uri: string) => {
  if (!canUseAndroidPoseAlignment() || !nativeModule) {
    return null;
  }

  const localUri = normalizeFileUri(uri);
  if (!localUri) {
    return null;
  }

  return nativeModule.analyzePose(localUri);
};
