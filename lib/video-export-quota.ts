import { type User } from "firebase/auth";
import {
  doc,
  getDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { firebaseFunctions, firestore } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const FREE_WEEKLY_VIDEO_EXPORT_LIMIT = 1;
export const PRO_WEEKLY_VIDEO_EXPORT_LIMIT = 15;
export const EXPERT_WEEKLY_VIDEO_EXPORT_LIMIT = 30;

export type WeeklyVideoExportUsage = {
  weekId: string;
  weekLabel: string;
  count: number;
  limit: number;
  remaining: number;
};

export type WeeklyVideoExportReservation = WeeklyVideoExportUsage & {
  reservationId: string;
};

type PendingWeeklyVideoExportCompletion = {
  userId: string;
  reservationId: string;
  limit: number;
  createdAt: string;
  lastAttemptAt?: string;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_WEEKLY_VIDEO_EXPORT_COMPLETIONS_KEY =
  "pendingWeeklyVideoExportCompletions";

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
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
  }

  return doc(firestore, "users", user.uid, "usage", "videoExports", "weeks", weekId);
};

const reserveWeeklyVideoExportCallable = () => {
  if (!firebaseFunctions) {
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
  }

  return httpsCallable(firebaseFunctions, "reserveWeeklyVideoExport");
};

const releaseWeeklyVideoExportCallable = () => {
  if (!firebaseFunctions) {
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
  }

  return httpsCallable(firebaseFunctions, "releaseWeeklyVideoExport");
};

const completeWeeklyVideoExportCallable = () => {
  if (!firebaseFunctions) {
    throw new Error("Firebase ?곌껐 ?뺣낫媛 ?꾩쭅 ?ㅼ젙?섏? ?딆븯?듬땲??");
  }

  return httpsCallable(firebaseFunctions, "completeWeeklyVideoExport");
};

export const buildWeeklyVideoExportUsage = ({
  weekId,
  weekLabel,
  count,
  limit
}: {
  weekId: string;
  weekLabel: string;
  count: number;
  limit: number;
}): WeeklyVideoExportUsage => {
  const safeCount = Math.max(0, Number(count) || 0);
  const safeLimit = Math.max(0, Number(limit) || 0);

  return {
    weekId,
    weekLabel,
    count: safeCount,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - safeCount)
  };
};

export const buildWeeklyVideoExportReservation = (
  data: Partial<WeeklyVideoExportReservation>
): WeeklyVideoExportReservation => {
  if (typeof data.reservationId !== "string" || !data.reservationId) {
    throw new Error("MP4 ????덉빟 ?뺣낫瑜??뺤씤?섏? 紐삵뻽?듬땲??");
  }

  return {
    ...buildWeeklyVideoExportUsage({
      weekId: typeof data.weekId === "string" ? data.weekId : "",
      weekLabel: typeof data.weekLabel === "string" ? data.weekLabel : "",
      count: Number(data.count ?? 0),
      limit: Number(data.limit ?? 0)
    }),
    reservationId: data.reservationId
  };
};

const buildWeeklyVideoExportUsageFromResponse = (
  data: Partial<WeeklyVideoExportUsage>
) =>
  buildWeeklyVideoExportUsage({
    weekId: typeof data.weekId === "string" ? data.weekId : "",
    weekLabel: typeof data.weekLabel === "string" ? data.weekLabel : "",
    count: Number(data.count ?? 0),
    limit: Number(data.limit ?? 0)
  });

const readPendingWeeklyVideoExportCompletions = async () => {
  const raw = await AsyncStorage.getItem(PENDING_WEEKLY_VIDEO_EXPORT_COMPLETIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is PendingWeeklyVideoExportCompletion =>
        typeof item?.userId === "string" &&
        typeof item?.reservationId === "string" &&
        item.userId.length > 0 &&
        item.reservationId.length > 0
    );
  } catch {
    return [];
  }
};

const writePendingWeeklyVideoExportCompletions = async (
  pending: PendingWeeklyVideoExportCompletion[]
) => {
  if (pending.length === 0) {
    await AsyncStorage.removeItem(PENDING_WEEKLY_VIDEO_EXPORT_COMPLETIONS_KEY);
    return;
  }

  await AsyncStorage.setItem(
    PENDING_WEEKLY_VIDEO_EXPORT_COMPLETIONS_KEY,
    JSON.stringify(pending)
  );
};

export const canReserveWeeklyVideoExport = ({
  count,
  limit
}: {
  count: number;
  limit: number;
}) => Math.max(0, Number(limit) || 0) > 0 && Math.max(0, Number(count) || 0) < limit;

export const getWeeklyVideoExportUsage = async (
  user: User | null,
  limit = FREE_WEEKLY_VIDEO_EXPORT_LIMIT
): Promise<WeeklyVideoExportUsage | null> => {
  if (!user) {
    return null;
  }

  const { weekId, weekLabel } = getCurrentVideoExportWeek();
  const snapshot = await getDoc(getWeeklyUsageRef(user, weekId));
  const count = snapshot.exists()
    ? Math.max(0, Number(snapshot.data().count ?? 0))
    : 0;

  return buildWeeklyVideoExportUsage({
    weekId,
    weekLabel,
    count,
    limit
  });
};

export const reserveWeeklyVideoExport = async (
  user: User,
  limit = FREE_WEEKLY_VIDEO_EXPORT_LIMIT
): Promise<WeeklyVideoExportReservation> => {
  if (!user) {
    throw new Error("濡쒓렇????MP4 ?곸긽??留뚮뱾 ???덉뒿?덈떎.");
  }

  const result = await reserveWeeklyVideoExportCallable()({ limit });
  return buildWeeklyVideoExportReservation(
    result.data as Partial<WeeklyVideoExportReservation>
  );
};

export const completeWeeklyVideoExport = async (
  user: User,
  reservationId: string
) => {
  if (!user || !reservationId) {
    return null;
  }

  const result = await completeWeeklyVideoExportCallable()({ reservationId });
  return buildWeeklyVideoExportUsageFromResponse(
    result.data as Partial<WeeklyVideoExportUsage>
  );
};

export const recordPendingWeeklyVideoExportCompletion = async ({
  user,
  reservationId,
  limit = FREE_WEEKLY_VIDEO_EXPORT_LIMIT
}: {
  user: User | null;
  reservationId?: string | null;
  limit?: number;
}) => {
  if (!user || !reservationId) {
    return;
  }

  const pending = await readPendingWeeklyVideoExportCompletions();
  const nextItem: PendingWeeklyVideoExportCompletion = {
    userId: user.uid,
    reservationId,
    limit,
    createdAt: new Date().toISOString()
  };
  const nextPending = [
    ...pending.filter(
      (item) => item.userId !== user.uid || item.reservationId !== reservationId
    ),
    nextItem
  ];

  await writePendingWeeklyVideoExportCompletions(nextPending);
};

export const flushPendingWeeklyVideoExportCompletions = async (
  user: User | null,
  limit = FREE_WEEKLY_VIDEO_EXPORT_LIMIT
) => {
  if (!user) {
    return null;
  }

  const pending = await readPendingWeeklyVideoExportCompletions();
  const userPending = pending.filter((item) => item.userId === user.uid);
  if (userPending.length === 0) {
    return null;
  }

  let latestUsage: WeeklyVideoExportUsage | null = null;
  const retained: PendingWeeklyVideoExportCompletion[] = pending.filter(
    (item) => item.userId !== user.uid
  );

  for (const item of userPending) {
    try {
      const completedUsage = await completeWeeklyVideoExport(user, item.reservationId);
      if (completedUsage) {
        latestUsage = completedUsage;
      }
    } catch {
      retained.push({
        ...item,
        limit: item.limit || limit,
        lastAttemptAt: new Date().toISOString()
      });
    }
  }

  await writePendingWeeklyVideoExportCompletions(retained);
  return latestUsage;
};

export const releaseWeeklyVideoExport = async (
  user: User,
  reservationId?: string | null
) => {
  if (!user) {
    return null;
  }

  const result = await releaseWeeklyVideoExportCallable()(
    reservationId ? { reservationId } : {}
  );
  return buildWeeklyVideoExportUsageFromResponse(
    result.data as Partial<WeeklyVideoExportUsage>
  );
};
