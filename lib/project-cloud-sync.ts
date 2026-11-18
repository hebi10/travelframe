import type { User } from "firebase/auth";

import { getAppSettings, isCloudBackupTargetEnabled } from "@/lib/app-settings";
import { getBackupFailures } from "@/lib/backup-failure-queue";
import { getBodyProjects, getBodyProjectById } from "@/lib/body-project-library";
import { getSelectedCloudBackupProjectIds } from "@/lib/cloud-backup-project-slots";
import {
  backupImageBundleWork,
  backupMadeVideo,
  backupPhotoIfEnabled,
  backupProjectSupplementIfEnabled
} from "@/lib/cloud-backup";
import { firebaseAuth } from "@/lib/firebase";
import { localStorageAdapter } from "@/lib/local-storage";
import { assertLocalLibraryOwner } from "@/lib/local-library-owner";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { projectWantsCloudBackup } from "@/lib/project-save-policy";
import {
  enqueueProjectCloudSync,
  processProjectCloudSyncQueue,
  type ProjectCloudSyncTask
} from "@/lib/project-cloud-sync-queue";
import { getPhotos } from "@/lib/photo-library";
import { isCreatorSubscriptionActive, type UserSubscription } from "@/lib/subscription";
import { getMadeVideos } from "@/lib/video-library";
import { getImageBundleWorks } from "@/lib/work-library";

const INITIAL_SYNC_KEY = "body-frame.initial-cloud-project-sync.v1";

const getInitialSyncIds = async (): Promise<string[]> => {
  const value = await localStorageAdapter.getItem(INITIAL_SYNC_KEY);
  if (!value) return [];
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data)
      ? data.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const markInitialSynced = async (projectId: string) => {
  const existing = await getInitialSyncIds();
  if (!existing.includes(projectId)) {
    await localStorageAdapter.setItem(
      INITIAL_SYNC_KEY, JSON.stringify([...existing, projectId])
    );
  }
};

export const prepareProjectCloudSync = async ({
  user,
  subscription
}: {
  user: User;
  subscription: UserSubscription;
}) => {
  if (!isCreatorSubscriptionActive(subscription)) return;
  if (firebaseAuth?.currentUser?.uid !== user.uid) return;
  await assertLocalLibraryOwner(user.uid);
  const [projects, completedIds, selectedIds, failures, photos, settings] = await Promise.all([
    getBodyProjects(),
    getInitialSyncIds(),
    getSelectedCloudBackupProjectIds(
      user, getPlanEntitlements({ isLoggedIn: true, subscription }).maxCloudBackupProjects
    ),
    getBackupFailures(),
    getPhotos(),
    getAppSettings()
  ]);
  const selected = projects.filter(
    (project) => selectedIds.has(project.id) &&
      projectWantsCloudBackup(
        project, isCloudBackupTargetEnabled(settings, "photos")
      )
  );
  for (const project of selected) {
    if (!completedIds.includes(project.id)) {
      await enqueueProjectCloudSync({ projectId: project.id, kind: "initial" });
    }
  }
  const selectedProjectIds = new Set(selected.map((project) => project.id));
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  for (const failure of failures) {
    if (failure.kind !== "photo") continue;
    const photo = photoById.get(failure.id);
    if (photo?.projectId && selectedProjectIds.has(photo.projectId)) {
      await enqueueProjectCloudSync({
        projectId: photo.projectId,
        kind: "photo",
        itemId: photo.id
      });
    }
  }
};

const syncTask = async ({
  user,
  subscription,
  task
}: {
  user: User;
  subscription: UserSubscription;
  task: ProjectCloudSyncTask;
}) => {
  if (firebaseAuth?.currentUser?.uid !== user.uid) {
    throw new Error("백업 계정이 변경되었습니다.");
  }
  await assertLocalLibraryOwner(user.uid);
  if (!isCreatorSubscriptionActive(subscription)) {
    throw new Error("클라우드 구독이 활성화되지 않았습니다.");
  }
  const [project, selectedIds, settings] = await Promise.all([
    getBodyProjectById(task.projectId),
    getSelectedCloudBackupProjectIds(
      user, getPlanEntitlements({ isLoggedIn: true, subscription }).maxCloudBackupProjects
    ),
    getAppSettings()
  ]);
  if (!project || !selectedIds.has(project.id) ||
      !projectWantsCloudBackup(
        project, isCloudBackupTargetEnabled(settings, "photos")
      )) return;

  if (task.kind === "supplement") {
    await backupProjectSupplementIfEnabled({ user, subscription, projectId: project.id });
    return;
  }
  if (task.kind === "photo" && task.itemId) {
    const photo = (await getPhotos()).find((item) =>
      item.id === task.itemId && item.projectId === project.id
    );
    if (photo) await backupPhotoIfEnabled({ user, subscription, photo });
    return;
  }
  if (task.kind === "video" && task.itemId) {
    const video = (await getMadeVideos()).find((item) =>
      item.id === task.itemId && item.projectId === project.id
    );
    if (video) await backupMadeVideo({ user, subscription, video, enabled: true });
    return;
  }
  if (task.kind === "image-work" && task.itemId) {
    const photos = await getPhotos();
    const projectPhotoIds = new Set(
      photos.filter((item) => item.projectId === project.id).map((item) => item.id)
    );
    const work = (await getImageBundleWorks()).find((item) =>
      item.id === task.itemId &&
      item.photoIds.length > 0 &&
      item.photoIds.every((id) => projectPhotoIds.has(id))
    );
    if (work) await backupImageBundleWork({ user, subscription, work, enabled: true });
    return;
  }
  if (task.kind !== "initial") return;

  await backupProjectSupplementIfEnabled({ user, subscription, projectId: project.id });
  const photos = (await getPhotos()).filter((item) => item.projectId === project.id);
  for (const photo of photos) {
    await backupPhotoIfEnabled({ user, subscription, photo });
  }
  const videos = (await getMadeVideos()).filter((item) => item.projectId === project.id);
  for (const video of videos) {
    await backupMadeVideo({ user, subscription, video, enabled: true });
  }
  await markInitialSynced(project.id);
};

export const flushProjectCloudSync = ({
  user,
  subscription,
  now
}: {
  user: User | null;
  subscription: UserSubscription;
  now?: number;
}) => {
  if (!user || firebaseAuth?.currentUser?.uid !== user.uid) return Promise.resolve(0);
  if (!isCreatorSubscriptionActive(subscription)) return Promise.resolve(0);
  return processProjectCloudSyncQueue({
    execute: (task) => syncTask({ user, subscription, task }),
    ...(now === undefined ? {} : { now })
  });
};
