export const APP_GUIDE_VERSION = 1;

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
      id: "camera-photo-guide",
      title: "사진 가이드",
      description: "이전 사진을 반투명하게 올려 같은 구도로 촬영합니다.",
      targetLabel: "사진 가이드 띄우기",
      placement: "bottom"
    },
    {
      id: "camera-guide-setting",
      title: "가이드 설정",
      description: "중앙점, 중앙원, 3분할 등 구도 보조선을 바꿀 수 있습니다.",
      targetLabel: "가이드 설정",
      placement: "bottom"
    },
    {
      id: "camera-shutter",
      title: "촬영 버튼",
      description: "현재 화면을 사진으로 촬영합니다.",
      targetLabel: "촬영 버튼",
      placement: "top"
    },
    {
      id: "camera-recent-photo",
      title: "최근 사진",
      description: "마지막 촬영 사진을 확인하고 편집으로 이동합니다.",
      targetLabel: "최근 사진",
      placement: "top"
    }
  ],
  studio: [
    {
      id: "studio-photos",
      title: "사진",
      description: "촬영한 원본 사진을 확인하고 단일 사진 편집으로 이동합니다.",
      targetLabel: "사진 탭",
      placement: "top"
    },
    {
      id: "studio-edit",
      title: "편집",
      description: "편집한 사진과 여러 사진 작업을 시작합니다.",
      targetLabel: "편집 탭",
      placement: "top"
    },
    {
      id: "studio-works",
      title: "작업물",
      description: "저장한 이미지 묶음과 만든 영상을 다시 확인합니다.",
      targetLabel: "작업물 탭",
      placement: "top"
    },
    {
      id: "studio-save",
      title: "핸드폰 저장",
      description: "완성한 사진과 영상을 앱 안과 핸드폰에 저장할 수 있습니다.",
      targetLabel: "저장 버튼",
      placement: "bottom"
    }
  ],
  tripClip: [
    {
      id: "trip-clip-photos",
      title: "사진 선택",
      description: "영상에 사용할 사진을 추가하고 순서를 정합니다.",
      targetLabel: "사진 탭",
      placement: "bottom"
    },
    {
      id: "trip-clip-timeline",
      title: "타임라인",
      description: "사진 순서와 노출 시간을 조절합니다.",
      targetLabel: "타임라인 탭",
      placement: "bottom"
    },
    {
      id: "trip-clip-video",
      title: "영상 미리보기",
      description: "비율, 전환 효과, 재생 상태를 확인합니다.",
      targetLabel: "영상 탭",
      placement: "bottom"
    },
    {
      id: "trip-clip-export",
      title: "내보내기",
      description: "완성한 영상을 저장합니다. 무료 사용자는 주 1회까지 만들 수 있습니다.",
      targetLabel: "내보내기 탭",
      placement: "bottom"
    }
  ],
  account: [
    {
      id: "account-login",
      title: "로그인",
      description: "이메일 또는 Google 계정으로 로그인해 작업 기록을 관리합니다.",
      targetLabel: "로그인 영역",
      placement: "top"
    },
    {
      id: "account-plan",
      title: "플랜 안내",
      description: "광고 제거, 영상 내보내기, 백업 기능 등 프리미엄 기능을 확인합니다.",
      targetLabel: "플랜 영역",
      placement: "center"
    },
    {
      id: "account-backup",
      title: "작업물 보관",
      description: "로그인한 계정으로 작업물을 안전하게 보관할 수 있습니다.",
      targetLabel: "백업 영역",
      placement: "bottom"
    }
  ],
  settings: [
    {
      id: "settings-display",
      title: "화면 설정",
      description: "라이트/다크 모드와 글자 크기를 앱에 맞게 조절합니다.",
      targetLabel: "앱 설정",
      placement: "top"
    },
    {
      id: "settings-guide",
      title: "가이드 설정",
      description: "카메라, 편집, 영상 만들기에서 함께 사용하는 기본 가이드를 설정합니다.",
      targetLabel: "가이드 설정",
      placement: "center"
    },
    {
      id: "settings-replay",
      title: "가이드 다시 보기",
      description: "사용 방법이 다시 필요하면 이곳에서 가이드를 초기화할 수 있습니다.",
      targetLabel: "사용 가이드",
      placement: "bottom"
    }
  ]
};
