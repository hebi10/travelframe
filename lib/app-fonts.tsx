import { useFonts } from "expo-font";
import { createContext, type ReactNode, useContext } from "react";

import type { FontStyle } from "@/lib/app-settings";

type AppFontOption = {
  value: FontStyle;
  label: string;
  detail: string;
  family: string;
  sourceUri: string;
  license: "SIL Open Font License 1.1";
  licenseUrl: string;
};

export const APP_FONT_OPTIONS: AppFontOption[] = [
  {
    value: "noto_sans_kr",
    label: "Noto Sans KR",
    detail: "기본 UI에 잘 맞는 선명한 고딕체입니다.",
    family: "TravelFrame-NotoSansKR",
    sourceUri: "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
    license: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt"
  },
  {
    value: "nanum_gothic",
    label: "Nanum Gothic",
    detail: "익숙하고 단정한 화면용 고딕체입니다.",
    family: "TravelFrame-NanumGothic",
    sourceUri: "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf",
    license: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/nanumgothic/OFL.txt"
  },
  {
    value: "gowun_dodum",
    label: "Gowun Dodum",
    detail: "부드럽고 편안한 인상의 돋움체입니다.",
    family: "TravelFrame-GowunDodum",
    sourceUri: "https://raw.githubusercontent.com/google/fonts/main/ofl/gowundodum/GowunDodum-Regular.ttf",
    license: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/gowundodum/OFL.txt"
  },
  {
    value: "gugi",
    label: "Gugi",
    detail: "각진 인상이 강한 개성형 제목 폰트입니다.",
    family: "TravelFrame-Gugi",
    sourceUri: "https://raw.githubusercontent.com/google/fonts/main/ofl/gugi/Gugi-Regular.ttf",
    license: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/gugi/OFL.txt"
  },
  {
    value: "black_han_sans",
    label: "Black Han Sans",
    detail: "굵고 강한 제목용 한글 디스플레이 폰트입니다.",
    family: "TravelFrame-BlackHanSans",
    sourceUri: "https://raw.githubusercontent.com/google/fonts/main/ofl/blackhansans/BlackHanSans-Regular.ttf",
    license: "SIL Open Font License 1.1",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/blackhansans/OFL.txt"
  }
];

export const APP_FONT_SOURCES = APP_FONT_OPTIONS.reduce(
  (sources, option) => ({
    ...sources,
    [option.family]: { uri: option.sourceUri }
  }),
  {} as Record<string, { uri: string }>
);

const FontLoadContext = createContext(false);

export function FontLoadProvider({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts(APP_FONT_SOURCES);

  return (
    <FontLoadContext.Provider value={fontsLoaded && !fontError}>
      {children}
    </FontLoadContext.Provider>
  );
}

export const useAppFontsReady = () => useContext(FontLoadContext);

export const getFontFamilyForStyle = (
  fontStyle: FontStyle,
  fontsReady: boolean
) =>
  fontsReady
    ? APP_FONT_OPTIONS.find((option) => option.value === fontStyle)?.family
    : undefined;

export const getFontOptionLabel = (fontStyle: FontStyle) =>
  APP_FONT_OPTIONS.find((option) => option.value === fontStyle)?.label ??
  APP_FONT_OPTIONS[0].label;
