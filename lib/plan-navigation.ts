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

export const getPlanReturnPath = (source: unknown) => {
  switch (source) {
    case "camera":
      return "/camera" as const;
    case "records":
    case "project":
      return "/studio" as const;
    case "video":
      return "/video-create" as const;
    case "backup":
    case "settings":
      return "/settings" as const;
    default:
      return "/plans" as const;
  }
};
