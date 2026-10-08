import {
  isAdFreeSubscription,
  type SubscriptionCheckStatus,
  type UserSubscription
} from "@/lib/subscription";

export type AdPlacement =
  | "home"
  | "studio"
  | "photo_detail"
  | "video_detail"
  | "pre_video_export"
  | "post_video_save";

export const shouldShowAds = (
  subscription: UserSubscription | null,
  subscriptionStatus: SubscriptionCheckStatus = "loading"
) =>
  subscriptionStatus === "verified" &&
  subscription !== null &&
  !isAdFreeSubscription(subscription);

export const getAdPlacementLabel = (placement: AdPlacement) => {
  switch (placement) {
    case "home":
      return "홈 광고";
    case "studio":
      return "편집 화면 광고";
    case "photo_detail":
      return "사진 상세 광고";
    case "video_detail":
      return "영상 상세 광고";
    case "pre_video_export":
      return "영상 생성 전 광고";
    case "post_video_save":
      return "영상 저장 완료 광고";
    default:
      return "광고";
  }
};
