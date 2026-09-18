export const APP_GUIDE_VERSION = 3;

export type AppGuideTabKey =
  | "camera"
  | "studio"
  | "tripClip"
  | "account"
  | "settings";

export type AppGuidePlacement = "top" | "center" | "bottom";

export type AppGuideStep = {
  id: string;
  title: string;
  description: string;
  targetLabel?: string;
  placement: AppGuidePlacement;
};

export const APP_GUIDE_STEPS: Record<AppGuideTabKey, AppGuideStep[]> = {
  camera: [
    {
      id: "body-frame-welcome",
      title: "바디 프레임에 오신 것을 환영합니다.",
      description:
        "매일 같은 위치에서 사진을 찍고 저장해보세요. 다음 촬영부터 이전 사진을 반투명하게 겹쳐 같은 위치와 자세를 맞출 수 있습니다.",
      placement: "center"
    }
  ],
  studio: [
    {
      id: "body-frame-records",
      title: "프로젝트별 변화를 확인하세요",
      description:
        "기록 탭에서는 프로젝트 진행률을 보고, 프로젝트 안에서 날짜별 사진을 한눈에 확인할 수 있습니다.",
      targetLabel: "기록",
      placement: "center"
    }
  ],
  tripClip: [
    {
      id: "body-frame-video",
      title: "변화 영상을 만드세요",
      description:
        "현재 프로젝트의 기록 사진을 0.1초씩 이어 9:16 변화 영상으로 저장합니다.",
      targetLabel: "변화 영상",
      placement: "center"
    }
  ],
  account: [
    {
      id: "body-frame-account",
      title: "계정과 플랜을 관리하세요",
      description:
        "현재 플랜, 기록 상태, 클라우드 백업과 Google Play 구매·복원을 확인할 수 있습니다.",
      targetLabel: "계정 및 플랜",
      placement: "center"
    }
  ],
  settings: [
    {
      id: "body-frame-settings",
      title: "필요한 설정만 모았습니다",
      description:
        "촬영, 저장 및 백업, 변화 영상, 화면, 계정 및 플랜, 개인정보 설정을 한곳에서 관리합니다.",
      targetLabel: "설정",
      placement: "center"
    }
  ]
};
