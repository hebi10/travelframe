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
  "비로그인/무료 로그인: 이미지 100개, 영상 30개, 클라우드 백업 없음",
  "사진 편집과 MP4 영상 주 1회",
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
    price: "월 990원",
    billing: "월 결제",
    summary: "Pro는 주 15회 영상 출력, 워터마크 제거, 클라우드 백업, 광고 제거를 함께 제공합니다.",
    benefits: [
      "영상 출력 주 15회",
      "구독 기간 동안 앱 전반의 광고 제거",
      "워터마크/브랜딩 제거",
      "고급 출력 기능과 고해상도 저장",
      "Pro: 이미지 200개, 영상 50개, 음악 10개, 클라우드 백업 2GB",
      "백업/복원 및 기기 변경 시 복원"
    ]
  },
  {
    id: "expert",
    title: "Expert",
    price: "월 1,990원",
    billing: "월 결제",
    summary: "Expert는 Pro 기능에 더 큰 저장 한도와 주 30회 영상 출력을 제공합니다.",
    benefits: [
      "영상 출력 주 30회",
      "광고 제거, 워터마크 제거, 고급 출력",
      "이미지 300개, 영상 100개, 음악 20개, 클라우드 백업 5GB",
      "Pro 기능 모두 포함"
    ]
  }
];
