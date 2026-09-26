export const APP_GUIDE_VERSION = 4;

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
        "같은 구도와 자세로 사진을 쌓아 몸의 변화를 기록하는 앱입니다. 처음에는 프로젝트를 만들고 첫 사진을 찍으면 됩니다.",
      placement: "center"
    },
    {
      id: "body-frame-project",
      title: "프로젝트로 기록을 나눕니다",
      description:
        "운동 기간이나 목표별로 프로젝트를 만들 수 있습니다. 촬영 화면 상단에서 프로젝트를 바꾸고 기록 탭에서 전체 진행 상황을 확인하세요.",
      targetLabel: "프로젝트",
      placement: "center"
    },
    {
      id: "body-frame-reference",
      title: "기준 사진으로 같은 자세를 맞춥니다",
      description:
        "두 번째 촬영부터 첫 사진 또는 최근 사진을 반투명하게 겹쳐 볼 수 있습니다. 표시 여부와 투명도는 촬영 화면과 설정에서 같은 값으로 유지됩니다.",
      targetLabel: "기준 사진",
      placement: "center"
    },
    {
      id: "body-frame-measurements",
      title: "사진과 몸의 수치를 함께 기록합니다",
      description:
        "프로젝트별로 몸무게, 체지방률, 골격근량, 허리둘레를 선택해 기록할 수 있습니다. 지원되는 Android 기기에서는 Health Connect의 몸무게와 체지방률도 직접 가져올 수 있습니다.",
      targetLabel: "기록",
      placement: "center"
    },
    {
      id: "body-frame-video",
      title: "쌓인 사진을 변화 영상으로 만듭니다",
      description:
        "사진 순서를 기준으로 변화 영상을 만들고 간격, 화질, 비율과 날짜·몸무게·체지방 텍스트를 선택할 수 있습니다.",
      targetLabel: "영상",
      placement: "center"
    },
    {
      id: "body-frame-settings-backup",
      title: "알림, 화면, 계정과 백업을 관리합니다",
      description:
        "프로젝트별 촬영 알림을 설정하고 화면 모드와 폰트를 바꿀 수 있습니다. 로그인 후에는 플랜과 Google Play 구매를 관리하고 Pro 이상에서는 선택 프로젝트를 클라우드에 백업할 수 있습니다.",
      targetLabel: "설정",
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
        "기본 3:4 비율로 변화 영상을 만듭니다. 사진 간격과 비율은 영상 화면에서 바꿀 수 있습니다.",
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
