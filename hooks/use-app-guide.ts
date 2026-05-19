import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  APP_GUIDE_STEPS,
  type AppGuideStep,
  type AppGuideTabKey
} from "@/constants/app-guide-steps";
import {
  markGuideTabSeen,
  shouldShowGuideForTab
} from "@/lib/guide-progress";

export function useAppGuide(tabKey: AppGuideTabKey, replaySignal = 0) {
  const steps = useMemo(() => APP_GUIDE_STEPS[tabKey], [tabKey]);
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadGuide = async () => {
        if (tabKey !== "home") {
          return;
        }

        const shouldShow = await shouldShowGuideForTab(tabKey);

        if (isActive && shouldShow && steps.length > 0) {
          setStepIndex(0);
          setVisible(true);
        }
      };

      void loadGuide();

      return () => {
        isActive = false;
      };
    }, [steps.length, tabKey])
  );

  useEffect(() => {
    if (replaySignal <= 0 || steps.length <= 0) {
      return;
    }

    setStepIndex(0);
    setVisible(true);
  }, [replaySignal, steps.length]);

  const finish = useCallback(async () => {
    setVisible(false);
    await markGuideTabSeen(tabKey);
  }, [tabKey]);

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      if (current >= steps.length - 1) {
        void finish();
        return current;
      }

      return current + 1;
    });
  }, [finish, steps.length]);

  return {
    visible,
    step: steps[stepIndex] as AppGuideStep | undefined,
    stepIndex,
    totalSteps: steps.length,
    canGoBack: stepIndex > 0,
    goBack,
    goNext,
    skip: finish
  };
}
