import type { CloudBackupOverview } from "@/lib/cloud-backup";
import type { UserSubscriptionProducts } from "@/lib/subscription";

export type AuthMode = "signIn" | "signUp" | "recover";
export type PaymentPlanId = "adRemove" | "creator" | "expert";

export type PaymentPlan = {
  id: PaymentPlanId;
  title: string;
  price: string;
  billing: string;
  summary: string;
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
    price: "1,990원",
    billing: "1회 결제",
    summary: "한 번 결제하면 광고를 영구 제거합니다. 무료 플랜 기능은 그대로 유지됩니다.",
    benefits: [
      "앱 전반의 광고 영구 제거",
      "무료 플랜 기능 유지",
      "Pro 기능 미포함"
    ]
  },
  {
    id: "creator",
    title: "Pro",
    price: "Google Play 가격",
    billing: "월 구독",
    summary: "Pro는 바디 프레임 365장 기록과 36.5초 변화 영상, 광고·워터마크 제거, 클라우드 백업을 제공합니다.",
    benefits: [
      "프로젝트당 최대 365장 기록",
      "최대 36.5초 변화 영상",
      "구독 기간 동안 앱 전반의 광고 제거",
      "워터마크/브랜딩 제거",
      "클라우드 백업과 상위 기록 한도"
    ]
  },
  {
    id: "expert",
    title: "Expert",
    price: "Google Play 가격",
    billing: "월 구독",
    summary: "Expert는 현재 바디 프레임 기록·변화 영상 길이 제한을 해제하고 상위 저장·백업 한도를 제공합니다.",
    benefits: [
      "바디 프레임 기록 수 제한 해제",
      "변화 영상 길이 제한 해제",
      "광고 및 워터마크 제거",
      "상위 로컬 저장·클라우드 백업 한도"
    ]
  }
];
