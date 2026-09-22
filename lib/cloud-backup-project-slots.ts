import type { User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { firebaseFunctions, firestore } from "@/lib/firebase";

export type CloudBackupProjectSlot = {
  id: string;
  slotNumber: number;
  projectId: string;
  status: "active" | "over_limit";
  selectedAt: string | null;
  updatedAt: string | null;
};

type SlotResponse = {
  slot: CloudBackupProjectSlot;
};

const callSlotFunction = async <Request, Response>(
  name: string,
  data: Request
): Promise<Response> => {
  if (!firebaseFunctions) {
    throw new Error("클라우드 백업 서버에 연결할 수 없습니다.");
  }

  const callable = httpsCallable<Request, Response>(firebaseFunctions, name);
  const result = await callable(data);
  return result.data;
};

export const getCloudBackupProjectSlots = async (
  user: User | null
): Promise<CloudBackupProjectSlot[]> => {
  if (!user || !firestore) {
    return [];
  }

  const snapshot = await getDocs(
    collection(firestore, "users", user.uid, "backupProjectSlots")
  );

  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        slotNumber: Math.max(1, Number(data.slotNumber ?? 1)),
        projectId: String(data.projectId ?? ""),
        status: data.status === "over_limit" ? "over_limit" : "active",
        selectedAt:
          typeof data.selectedAt === "string" ? data.selectedAt : null,
        updatedAt:
          typeof data.updatedAt === "string" ? data.updatedAt : null
      } satisfies CloudBackupProjectSlot;
    })
    .filter((slot) => Boolean(slot.projectId))
    .sort((first, second) => first.slotNumber - second.slotNumber);
};

export const selectCloudBackupProject = async ({
  user,
  projectId
}: {
  user: User;
  projectId: string;
}) => {
  if (!user.uid) {
    throw new Error("로그인 후 백업 프로젝트를 선택할 수 있습니다.");
  }

  return callSlotFunction<{ projectId: string }, SlotResponse>(
    "selectCloudBackupProject",
    { projectId }
  );
};

export const replaceCloudBackupProject = async ({
  user,
  slotId,
  projectId
}: {
  user: User;
  slotId: string;
  projectId: string;
}) => {
  if (!user.uid) {
    throw new Error("로그인 후 백업 프로젝트를 변경할 수 있습니다.");
  }

  return callSlotFunction<
    { slotId: string; projectId: string },
    SlotResponse & { deletedPhotoCount: number; deletedVideoCount: number }
  >("replaceCloudBackupProject", { slotId, projectId });
};

export const getSelectedCloudBackupProjectIds = async (user: User | null) =>
  new Set((await getCloudBackupProjectSlots(user)).map((slot) => slot.projectId));
