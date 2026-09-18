import type { PhotoRatioLabel } from "@/types/photo";

export type TripClipRatio = Extract<PhotoRatioLabel, "1:1" | "3:4" | "4:5" | "9:16" | "16:9">;

export type TripClipTemplate = "minimal" | "film-log" | "center-cut" | "reel-basic";

export type TripClipTransition = "fade" | "zoom" | "slide" | "none";

export type MusicTrack = {
  id: "none" | "calm" | "city" | "summer" | "night" | "minimal";
  label: string;
  detail: string;
  source: number | null;
};

export const TRIP_CLIP_RATIOS: TripClipRatio[] = ["9:16", "4:5", "1:1", "16:9", "3:4"];

export const TRIP_CLIP_TEMPLATES: {
  id: TripClipTemplate;
  label: string;
  detail: string;
}[] = [
  {
    id: "minimal",
    label: "Minimal",
    detail: "사진을 화면 가득 배치하고 느린 페이드로 넘깁니다."
  },
  {
    id: "film-log",
    label: "Film Log",
    detail: "검정 배경, 작은 기록 텍스트, 넓은 여백을 사용합니다."
  },
  {
    id: "center-cut",
    label: "Center Cut",
    detail: "같은 구도 사진을 중앙 기준으로 이어 보여줍니다."
  },
  {
    id: "reel-basic",
    label: "Reel Basic",
    detail: "릴스와 쇼츠에 맞춘 빠른 세로형 미리보기입니다."
  }
];

export const TRIP_CLIP_TRANSITIONS: {
  id: TripClipTransition;
  label: string;
}[] = [
  { id: "fade", label: "페이드" },
  { id: "zoom", label: "줌" },
  { id: "slide", label: "슬라이드" },
  { id: "none", label: "없음" }
];

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "none",
    label: "무음",
    detail: "배경음악 없이 재생합니다.",
    source: null
  },
  {
    id: "calm",
    label: "Calm",
    detail: "부드럽고 느린 변화 기록 무드입니다.",
    source: require("../assets/audio/calm.wav")
  },
  {
    id: "city",
    label: "City",
    detail: "도시 거리 사진에 어울리는 깔끔한 리듬입니다.",
    source: require("../assets/audio/city.wav")
  },
  {
    id: "summer",
    label: "Summer",
    detail: "밝은 분위기의 짧은 루프 샘플입니다.",
    source: require("../assets/audio/summer.wav")
  },
  {
    id: "night",
    label: "Night",
    detail: "차분하고 어두운 톤의 미리보기 음악입니다.",
    source: require("../assets/audio/night.wav")
  },
  {
    id: "minimal",
    label: "Minimal",
    detail: "절제된 편집에 어울리는 미니멀 톤입니다.",
    source: require("../assets/audio/minimal.wav")
  }
];
