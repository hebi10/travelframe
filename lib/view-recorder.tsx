import {
  type ComponentType,
  type ReactNode
} from "react";
import {
  UIManager,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

type ViewRecorder = {
  sessionId: string;
  snapshot: (options: Record<string, unknown>) => Promise<string>;
  record: (
    options: Record<string, unknown> & {
      onFrame?: (event: { frameIndex: number }) => void | Promise<void>;
      onProgress?: (event: { framesEncoded: number }) => void;
    }
  ) => Promise<string>;
};

type RecordingViewProps = {
  sessionId: string;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: {
    nativeEvent: { layout: { width: number; height: number } };
  }) => void;
  children?: ReactNode;
};

type ViewRecorderModule = {
  RecordingView: ComponentType<RecordingViewProps>;
  useViewRecorder: () => ViewRecorder;
};

let recorderModule: ViewRecorderModule | null | false = null;

const getRecorderModule = () => {
  if (recorderModule === false) {
    return null;
  }

  if (!recorderModule) {
    try {
      recorderModule = require("react-native-view-recorder") as ViewRecorderModule;
    } catch {
      recorderModule = false;
      return null;
    }
  }

  return recorderModule;
};

export const isRecordingViewAvailable = () => {
  return Boolean(
    getRecorderModule() &&
      (UIManager.getViewManagerConfig?.("RecordingView") ??
        UIManager.getViewManagerConfig?.("RCTRecordingView"))
  );
};

export const useOptionalViewRecorder = () => {
  const module = getRecorderModule();

  if (!module) {
    return {
      sessionId: "",
      snapshot: async () => {
        throw new Error("이미지 저장 기능이 현재 앱에 연결되지 않았습니다.");
      },
      record: async () => {
        throw new Error("MP4 저장 기능이 현재 앱에 연결되지 않았습니다.");
      }
    } satisfies ViewRecorder;
  }

  return module.useViewRecorder();
};

export function OptionalRecordingView({
  available,
  children,
  sessionId,
  style,
  onLayout
}: RecordingViewProps & { available: boolean }) {
  const module = getRecorderModule();

  if (available && module?.RecordingView) {
    const RecordingView = module.RecordingView;
    return (
      <RecordingView sessionId={sessionId} style={style} onLayout={onLayout}>
        {children}
      </RecordingView>
    );
  }

  return (
    <View style={style} onLayout={onLayout}>
      {children}
    </View>
  );
}
