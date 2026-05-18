import { type User } from "firebase/auth";
import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

export const FREE_WEEKLY_VIDEO_EXPORT_LIMIT = 1;

export type WeeklyVideoExportUsage = {
  weekId: string;
  weekLabel: string;
  count: number;
  limit: number;
  remaining: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getKstWeekStart = (date = new Date()) => {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const kstDay = kstDate.getUTCDay();
  const daysFromMonday = (kstDay + 6) % 7;
  return new Date(
    Date.UTC(
      kstDate.getUTCFullYear(),
      kstDate.getUTCMonth(),
      kstDate.getUTCDate() - daysFromMonday
    )
  );
};

export const getCurrentVideoExportWeek = (date = new Date()) => {
  const weekStart = getKstWeekStart(date);
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  const format = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  });

  return {
    weekId: weekStart.toISOString().slice(0, 10),
    weekLabel: `${format.format(weekStart)} - ${format.format(weekEnd)}`
  };
};

const getWeeklyUsageRef = (user: User, weekId: string) => {
  if (!firestore) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  return doc(firestore, "users", user.uid, "usage", "videoExports", "weeks", weekId);
};

export const getWeeklyVideoExportUsage = async (
  user: User | null
): Promise<WeeklyVideoExportUsage | null> => {
  if (!user) {
    return null;
  }

  const { weekId, weekLabel } = getCurrentVideoExportWeek();
  const snapshot = await getDoc(getWeeklyUsageRef(user, weekId));
  const count = snapshot.exists()
    ? Math.max(0, Number(snapshot.data().count ?? 0))
    : 0;

  return {
    weekId,
    weekLabel,
    count,
    limit: FREE_WEEKLY_VIDEO_EXPORT_LIMIT,
    remaining: Math.max(0, FREE_WEEKLY_VIDEO_EXPORT_LIMIT - count)
  };
};

export const reserveWeeklyVideoExport = async (user: User) => {
  const { weekId, weekLabel } = getCurrentVideoExportWeek();
  const usageRef = getWeeklyUsageRef(user, weekId);

  await runTransaction(usageRef.firestore, async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const currentCount = snapshot.exists()
      ? Math.max(0, Number(snapshot.data().count ?? 0))
      : 0;

    if (currentCount >= FREE_WEEKLY_VIDEO_EXPORT_LIMIT) {
      throw new Error(
        `무료 사용자는 이번 주에 MP4 영상을 ${FREE_WEEKLY_VIDEO_EXPORT_LIMIT}개까지 만들 수 있습니다. 다음 주에 다시 만들거나 구독을 이용해 주세요.`
      );
    }

    transaction.set(
      usageRef,
      {
        userId: user.uid,
        weekId,
        weekLabel,
        count: currentCount + 1,
        limit: FREE_WEEKLY_VIDEO_EXPORT_LIMIT,
        updatedAt: serverTimestamp(),
        createdAt: snapshot.exists() ? snapshot.data().createdAt ?? serverTimestamp() : serverTimestamp()
      },
      { merge: true }
    );
  });
};

export const releaseWeeklyVideoExport = async (user: User) => {
  const { weekId } = getCurrentVideoExportWeek();
  const usageRef = getWeeklyUsageRef(user, weekId);
  const snapshot = await getDoc(usageRef);
  const currentCount = snapshot.exists()
    ? Math.max(0, Number(snapshot.data().count ?? 0))
    : 0;

  if (currentCount <= 0) {
    return;
  }

  await setDoc(
    usageRef,
    {
      count: increment(-1),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};
