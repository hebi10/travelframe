import { router } from "expo-router";

export type PlanEntrySource = "camera" | "records" | "project" | "video" | "backup" | "settings";
export type SuggestedPlan = "Pro" | "Plus" | "Expert" | null;

export const openPlans = (source: PlanEntrySource, recommendation: SuggestedPlan = null) => {
  router.push({
    pathname: "/plans",
    params: {
      source,
      ...(recommendation ? { plan: recommendation.toLowerCase() } : {})
    }
  });
};
