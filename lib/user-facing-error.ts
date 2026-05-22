const developerErrorMarkers = [
  "npm run",
  "firebase:deploy",
  "Firebase Functions",
  "Firebase Storage",
  "Firebase 연결 정보",
  ".env",
  "Metro",
  "EAS",
  "개발 빌드",
  "native module",
  "Cannot find native module",
  "ExpoWebBrowser",
  "react-native",
  "node_modules",
  "Invariant Violation",
  "TypeError:",
  "ReferenceError:",
  "permission-denied",
  "storage/",
  "functions/",
  "auth/"
];

export const isDeveloperErrorMessage = (message: string) =>
  developerErrorMarkers.some((marker) => message.includes(marker));

const normalizeKnownUserMessage = (message: string) => {
  if (message.includes("구독이 활성화된 계정만 백업할 수 있습니다")) {
    return "구독이 활성화된 계정만 백업할 수 있습니다.";
  }

  return null;
};

export const getUserFacingErrorMessage = (error: unknown, fallback: string) => {
  if (__DEV__) {
    console.warn(fallback, error);
  }

  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === "string"
        ? error.trim()
        : "";

  if (!message) {
    return fallback;
  }

  const knownMessage = normalizeKnownUserMessage(message);
  if (knownMessage) {
    return knownMessage;
  }

  return isDeveloperErrorMessage(message) ? fallback : message;
};
