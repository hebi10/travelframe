import type { CloudBackupOverview } from "@/lib/cloud-backup";
import type { UserSubscriptionProducts } from "@/lib/subscription";

export type AuthMode = "signIn" | "signUp" | "recover";
export type PaymentPlanId = "adRemove" | "creator" | "plus" | "expert";

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
  "무료 플랜: 프로젝트당 최대 100장 기록",
  "변화 영상 최대 10초",
  "워터마크 포함, 광고 표시",
  "클라우드 백업은 Pro부터 사용 가능"
];

export const paymentPlans: PaymentPlan[] = [
  {
    id: "adRemove",
    title: "광고 제거",
    price: "2,000원",
    billing: "1회 결제",
    summary: "한 번 결제하면 광고를 영구 제거합니다. 무료 플랜의 프로젝트·사진 한도는 그대로 유지됩니다.",
    purchaseNotice:
      "Google Play를 통한 1회성 구매입니다. 정기 결제나 자동 갱신은 없습니다. Pro 월 구독은 광고·워터마크 제거와 로컬 프로젝트·사진 무제한, 클라우드 프로젝트 1개 백업을 함께 제공합니다.",
    benefits: [
      "앱 전반의 광고 영구 제거",
      "무료 플랜의 프로젝트 1개 · 프로젝트당 100장 유지",
      "클라우드 백업 미포함"
    ]
  },
  {
    id: "creator",
    title: "Pro",
    price: "1,990원",
    billing: "월 구독",
    summary:
      "로컬 프로젝트와 사진을 제한 없이 사용하고, 선택한 프로젝트 1개를 클라우드에 백업할 수 있습니다.",
    purchaseNotice:
      "Google Play 월 구독으로 취소 전까지 자동 갱신됩니다. 클라우드 백업 프로젝트는 구독 후 직접 선택하며, 선택한 프로젝트를 변경하려면 해당 프로젝트의 기존 클라우드 백업을 삭제하고 새 프로젝트를 처음부터 다시 업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.",
    benefits: [
      "로컬 프로젝트·사진 무제한",
      "클라우드 백업 프로젝트 1개",
      "선택 프로젝트당 사진 최대 365장 백업",
      "광고 및 워터마크 제거",
      "고급 영상 옵션"
    ]
  },
  {
    id: "plus",
    title: "Plus",
    price: "3,990원",
    billing: "월 구독",
    summary:
      "로컬 프로젝트와 사진을 제한 없이 사용하고, 최대 3개 프로젝트를 클라우드에 백업할 수 있습니다.",
    purchaseNotice:
      "Google Play 월 구독으로 취소 전까지 자동 갱신됩니다. 클라우드 백업 프로젝트는 구독 후 직접 선택하며, 선택한 프로젝트를 변경하려면 해당 프로젝트의 기존 클라우드 백업을 삭제하고 새 프로젝트를 처음부터 다시 업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.",
    benefits: [
      "로컬 프로젝트·사진 무제한",
      "클라우드 백업 프로젝트 최대 3개",
      "각 프로젝트당 사진 최대 365장 백업",
      "광고 및 워터마크 제거",
      "고급 영상 옵션"
    ]
  },
  {
    id: "expert",
    title: "Expert",
    price: "5,990원",
    billing: "월 구독",
    summary:
      "로컬 프로젝트와 사진을 제한 없이 사용하고, 최대 5개 프로젝트를 클라우드에 백업할 수 있습니다.",
    purchaseNotice:
      "Google Play 월 구독으로 취소 전까지 자동 갱신됩니다. 클라우드 백업 프로젝트는 구독 후 직접 선택하며, 선택한 프로젝트를 변경하려면 해당 프로젝트의 기존 클라우드 백업을 삭제하고 새 프로젝트를 처음부터 다시 업로드해야 합니다. 로컬 원본은 삭제되지 않습니다.",
    benefits: [
      "로컬 프로젝트·사진 무제한",
      "클라우드 백업 프로젝트 최대 5개",
      "각 프로젝트당 사진 최대 365장 백업",
      "광고 및 워터마크 제거",
      "고급 영상 옵션"
    ]
  }
];
