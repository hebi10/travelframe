import { formatBackupStorageUsage } from "@/lib/image-backup-utils";

export const formatQuotaValue = (used: number, limit: number) => {
  if (limit <= 0) {
    return "사용 불가";
  }

  const safeUsed = Math.max(0, used);
  const safeLimit = Math.max(0, limit);
  const remaining = Math.max(0, safeLimit - safeUsed);
  return `${safeUsed} / ${safeLimit} · 남은 ${remaining}`;
};

export const formatStorageQuotaValue = (usedBytes: number, limitBytes: number) => {
  if (limitBytes <= 0) {
    return "사용 불가";
  }

  return formatBackupStorageUsage(usedBytes, limitBytes);
};

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};

export const getAuthErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("auth/email-already-in-use")) {
    return "이미 가입된 이메일입니다.";
  }

  if (
    message.includes("auth/invalid-credential") ||
    message.includes("auth/wrong-password") ||
    message.includes("auth/user-not-found")
  ) {
    return "이메일 또는 비밀번호를 확인해 주세요.";
  }

  if (message.includes("auth/invalid-email")) {
    return "이메일 형식을 확인해 주세요.";
  }

  if (message.includes("auth/requires-recent-login")) {
    return "보안을 위해 다시 로그인한 뒤 비밀번호를 변경해 주세요.";
  }

  if (message.includes("auth/weak-password")) {
    return "비밀번호는 6자리 이상으로 입력해 주세요.";
  }

  if (message.includes("Firebase 연결 정보") || message.includes("Firebase Storage")) {
    return "Firebase 연결 정보가 아직 설정되지 않았습니다.";
  }

  if (message.includes("최대 3개")) {
    return "내 음악은 최대 3개까지 저장할 수 있습니다.";
  }

  if (message.includes("로그인 후 내 음악")) {
    return "로그인 후 내 음악을 관리할 수 있습니다.";
  }

  return "계정 처리 중 문제가 발생했습니다.";
};
