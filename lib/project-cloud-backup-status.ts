import type { User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";

import { getBodyProjects } from "@/lib/body-project-library";
import { getCloudBackupProjectSlots } from "@/lib/cloud-backup-project-slots";
import { firebaseAuth, firestore } from "@/lib/firebase";
import { assertLocalLibraryOwner } from "@/lib/local-library-owner";
import { getPhotos } from "@/lib/photo-library";
import { getProjectCloudSyncTasks } from "@/lib/project-cloud-sync-queue";

export type ProjectCloudBackupStatus = {
  projectId: string;
  name: string;
  slotNumber: number | null;
  slotStatus: "active" | "paused" | "over_limit" | "replacing" | "unselected";
  localPhotos: number;
  cloudPhotos: number;
  cloudVideos: number;
  cloudMeasurements: number;
  cloudBytes: number;
  waitingItems: number;
  lastBackedUpAt: string | null;
};

const finiteSize = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

const dateValue = (value: unknown): string | null => {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  if (value && typeof value === "object" && "toDate" in value &&
      typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
};

export const getProjectCloudBackupStatuses = async ({
  user
}: { user: User | null }): Promise<ProjectCloudBackupStatus[]> => {
  if (!user || !firestore || firebaseAuth?.currentUser?.uid !== user.uid) return [];
  await assertLocalLibraryOwner(user.uid);
  const [projects, slots, photos, tasks, remoteProjects, remotePhotos, remoteVideos, remoteMeasurements, remoteSettings] =
    await Promise.all([
      getBodyProjects(),
      getCloudBackupProjectSlots(user),
      getPhotos(),
      getProjectCloudSyncTasks(),
      getDocs(collection(firestore, "users", user.uid, "bodyProjects")),
      getDocs(collection(firestore, "users", user.uid, "photoBackups")),
      getDocs(collection(firestore, "users", user.uid, "videos")),
      getDocs(collection(firestore, "users", user.uid, "bodyMeasurements")),
      getDocs(collection(firestore, "users", user.uid, "bodyProjectSettings"))
    ]);
  if (firebaseAuth?.currentUser?.uid !== user.uid) {
    throw new Error("계정이 변경되어 프로젝트 백업 현황을 확인하지 못했습니다.");
  }

  const names = new Map(projects.map((project) => [project.id, project.name]));
  const localById = new Map(projects.map((project) => [project.id, project]));
  for (const item of remoteProjects.docs) {
    if (!names.has(item.id)) {
      const name = item.data().name;
      names.set(item.id, typeof name === "string" && name ? name : "복원 가능한 프로젝트");
    }
  }
  const slotMap = new Map(slots.map((slot) => [slot.projectId, slot]));

  return [...names.entries()].map(([projectId, name]) => {
    const slot = slotMap.get(projectId);
    const local = localById.get(projectId);
    const paused = local?.saveMode === "local_only" || (!local &&
      remoteProjects.docs.find((item) => item.id === projectId)?.data().saveMode === "local_only");
    const projectPhotos = remotePhotos.docs.filter((item) => item.data().projectId === projectId);
    const projectVideos = remoteVideos.docs.filter((item) => item.data().projectId === projectId);
    const projectMeasurements = remoteMeasurements.docs.filter((item) => item.data().projectId === projectId);
    const dates = [...projectPhotos, ...projectVideos, ...projectMeasurements]
      .map((item) => dateValue(item.data().lastBackedUpAt ?? item.data().backedUpAt))
      .filter((value): value is string => Boolean(value));
    const settingsDate = dateValue(
      remoteSettings.docs.find((item) => item.id === projectId)?.data().backedUpAt
    );
    if (settingsDate) dates.push(settingsDate);
    const cloudBytes =
      projectPhotos.reduce((sum, item) => sum + finiteSize(item.data().imageBackupSize ?? item.data().fileSize), 0) +
      projectVideos.reduce((sum, item) => sum + finiteSize(item.data().fileSize), 0);

    return {
      projectId, name,
      slotNumber: slot?.slotNumber ?? null,
      slotStatus: paused && slot?.status === "active" ? "paused" : slot?.status ?? "unselected",
      localPhotos: photos.filter((photo) => photo.projectId === projectId).length,
      cloudPhotos: projectPhotos.length,
      cloudVideos: projectVideos.length,
      cloudMeasurements: projectMeasurements.length,
      cloudBytes,
      waitingItems: tasks.filter((task) => task.projectId === projectId).length,
      lastBackedUpAt: dates.length > 0 ? dates.sort().at(-1) ?? null : null
    };
  });
};
