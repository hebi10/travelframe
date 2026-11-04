import type { CloudBackupOverview } from "@/lib/cloud-backup";
import type { UserSubscriptionProducts } from "@/lib/subscription";

export type AuthMode = "signIn" | "signUp" | "recover";
export type PaymentPlanId = "creator" | "plus" | "expert";

export type PaymentPlan = {
  id: PaymentPlanId;
  title: string;
  price: string;
  billing: string;
  summary: string;
  purchaseNotice: string;
  benefits: string[];
};

export type UsageStats = {
  originalPhotos: number;
  editedPhotos: number;
  imageBundles: number;
  videos: number;
};

export const initialStats: UsageStats = {
  originalPhotos: 0,
  editedPhotos: 0,
  imageBundles: 0,
  videos: 0
};

export const initialBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};

export const initialSubscriptionProducts: UserSubscriptionProducts = {
  adRemove: null,
  creatorMonthly: null,
  plusMonthly: null,
  expertMonthly: null
};

export const signedInBenefits = [
  "무료 플랜: 프로젝트 1개",
  "프로젝트당 사진 최대 100장",
  "변화 영상 만들기 가능",
  "워터마크 포함, 광고 표시"
];

export const paymentPlans: PaymentPlan[] = [
  {
    id: "creator",
    title: "Pro",
    price: "2,000원",
    billing: "월 구독",
    summary:
      "프로젝트 수는 제한 없이 만들고 각 프로젝트에 사진을 최대 365장까지 기록할 수 있으며, 선택한 프로젝트 1개를 클라우드에 백업할 수 있습니다.",
    purchaseNotice:
      "Google Play 월 구독으로 취소 전까지 자동 갱신됩니다. 구독은 Google Play 정기 결제에서 관리하거나 취소할 수 있으며 앱을 삭제해도 구독이 자동 취소되지는 않습니다. 실제 결제 금액은 Google Play 구매 화면에 표시되는 가격을 기준으로 합니다. 클라우드 백업 프로젝트는 구독 후 직접 선택하며, 선택한 프로젝트를 변경하려면 해당 프로젝트의 기존 클라우드 백업을 삭제하고 새 프로젝트를 처음부터 다시 업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.",
    benefits: [
      "프로젝트 수 무제한",
      "프로젝트당 사진 최대 365장",
      "클라우드 백업 프로젝트 1개",
      "선택 프로젝트당 사진 최대 365장 백업",
      "광고 및 워터마크 제거",
      "고급 영상 옵션"
    ]
  },
  {
    id: "plus",
    title: "Plus",
    price: "4,000원",
    billing: "월 구독",
    summary:
      "프로젝트 수는 제한 없이 만들고 각 프로젝트에 사진을 최대 365장까지 기록할 수 있으며, 최대 3개 프로젝트를 클라우드에 백업할 수 있습니다.",
    purchaseNotice:
      "Google Play 월 구독으로 취소 전까지 자동 갱신됩니다. 구독은 Google Play 정기 결제에서 관리하거나 취소할 수 있으며 앱을 삭제해도 구독이 자동 취소되지는 않습니다. 실제 결제 금액은 Google Play 구매 화면에 표시되는 가격을 기준으로 합니다. 클라우드 백업 프로젝트는 구독 후 직접 선택하며, 선택한 프로젝트를 변경하려면 해당 프로젝트의 기존 클라우드 백업을 삭제하고 새 프로젝트를 처음부터 다시 업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.",
    benefits: [
      "프로젝트 수 무제한",
      "프로젝트당 사진 최대 365장",
      "클라우드 백업 프로젝트 최대 3개",
      "각 프로젝트당 사진 최대 365장 백업",
      "광고 및 워터마크 제거",
      "고급 영상 옵션"
    ]
  },
  {
    id: "expert",
    title: "Expert",
    price: "6,000원",
    billing: "월 구독",
    summary:
      "프로젝트 수는 제한 없이 만들고 각 프로젝트에 사진을 최대 365장까지 기록할 수 있으며, 최대 5개 프로젝트를 클라우드에 백업할 수 있습니다.",
    purchaseNotice:
      "Google Play 월 구독으로 취소 전까지 자동 갱신됩니다. 구독은 Google Play 정기 결제에서 관리하거나 취소할 수 있으며 앱을 삭제해도 구독이 자동 취소되지는 않습니다. 실제 결제 금액은 Google Play 구매 화면에 표시되는 가격을 기준으로 합니다. 클라우드 백업 프로젝트는 구독 후 직접 선택하며, 선택한 프로젝트를 변경하려면 해당 프로젝트의 기존 클라우드 백업을 삭제하고 새 프로젝트를 처음부터 다시 업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.",
    benefits: [
      "프로젝트 수 무제한",
      "프로젝트당 사진 최대 365장",
      "클라우드 백업 프로젝트 최대 5개",
      "각 프로젝트당 사진 최대 365장 백업",
      "광고 및 워터마크 제거",
      "고급 영상 옵션"
    ]
  }
];
