import { useMemo } from "react";

import type { GuideType } from "@/constants/camera-guides";
import { getGuideSizeBounds } from "@/lib/app-settings";

export function useTripClipGuide(previewGuide: GuideType) {
  const previewGuideSizeBounds = useMemo(
    () => getGuideSizeBounds(previewGuide),
    [previewGuide]
  );

  return {
    previewGuideSizeBounds
  };
}
