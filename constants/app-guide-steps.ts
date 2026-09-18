export const APP_GUIDE_VERSION = 2;

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
      id: "body-frame-project",
      title: "프로젝트를 먼저 선택하세요",
      description: "바디프로필, 100일 기록, 벌크업처럼 목표별 프로젝트를 만들고 현재 프로젝트를 바꿀 수 있습니다.",
      targetLabel: "프로젝트",
      placement: "top"
    },
    {
      id: "body-frame-reference",
      title: "기준 사진에 몸을 맞추세요",
      description: "기준 사진을 반투명하게 겹쳐 같은 위치와 자세를 맞춘 뒤 촬영합니다.",
      targetLabel: "기준 사진",
      placement: "center"
    },
    {
      id: "body-frame-capture",
      title: "하루 한 장씩 기록하세요",
      description: "촬영한 사진은 선택한 프로젝트에 순서대로 저장되고 다음 촬영의 기준이 됩니다.",
      targetLabel: "촬영",
      placement: "bottom"
    }
  ],
  studio: [
    {
      id: "body-frame-records",
      title: "프로젝트별 변화를 확인하세요",
      description: "기록 탭에서 프로젝트별 사진 수, 목표 진행률과 예상 변화 영상 길이를 확인합니다.",
      targetLabel: "기록",
      placement: "top"
    },
    {
      id: "body-frame-record-detail",
      title: "프로젝트 기준을 관리하세요",
      description: "프로젝트 상세에서 이름, 목표 기록 수와 첫 사진/최근 사진 기준 방식을 바꿀 수 있습니다.",
      targetLabel: "프로젝트 상세",
      placement: "center"
    }
  ],
  tripClip: [
    {
      id: "body-frame-video",
      title: "변화 영상을 만드세요",
      description: "프로젝트 사진을 0.1초씩 이어 30fps 세로 변화 영상으로 만듭니다.",
      targetLabel: "변화 영상",
      placement: "center"
    },
    {
      id: "body-frame-video-save",
      title: "현재 프로젝트 기준으로 저장합니다",
      description: "기록 순서를 그대로 사용하고 플랜 한도 안에서 MP4 영상을 저장합니다.",
      targetLabel: "영상 만들기",
      placement: "bottom"
    }
  ],
  account: [
    {
      id: "body-frame-account",
      title: "계정과 플랜",
      description: "Google Play 구매, 구매 복원, 구독 상태와 클라우드 백업 권한을 확인합니다.",
      targetLabel: "계정 및 플랜",
      placement: "center"
    }
  ],
  settings: [
    {
      id: "body-frame-settings",
      title: "바디 프레임 설정",
      description: "촬영, 저장 및 백업, 변화 영상, 화면, 계정 및 플랜, 개인정보 설정을 한곳에서 찾을 수 있습니다.",
      targetLabel: "설정",
      placement: "center"
    },
    {
      id: "body-frame-advanced-settings",
      title: "세부 설정도 그대로 사용할 수 있습니다",
      description: "가이드 크기·색상, 저장 범위, 화질처럼 세밀한 옵션은 고급 설정에서 조정합니다.",
      targetLabel: "고급 설정",
      placement: "bottom"
    }
  ]
};
