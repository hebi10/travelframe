import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { BODY_FRAME_MEDIA_POLICY } from "@/constants/body-frame";
import {
  buildProjectPhotoIdRelativePath,
  buildProjectPreviewIdRelativePath
} from "@/lib/body-frame-stage2-utils";
import { optimizeBodyFramePhotoForStorage } from "@/lib/image-backup-utils";
import type { PhotoItem } from "@/types/photo";

const isRemoteUri = (uri?: string | null) =>
  typeof uri === "string" && /^https?:\/\//i.test(uri);

const requireDocumentDirectory = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error("이 기기에서는 파일 저장소를 사용할 수 없습니다.");
  }

  return FileSystem.documentDirectory;
};

const absolutePath = (relativePath: string) => `${requireDocumentDirectory()}${relativePath}`;

const ensureParentDirectory = async (uri: string) => {
  const slashIndex = uri.lastIndexOf("/");
  if (slashIndex <= 0) {
    return;
  }

  await FileSystem.makeDirectoryAsync(uri.slice(0, slashIndex + 1), {
    intermediates: true
  });
};

const replaceFileSafely = async (sourceUri: string, destinationUri: string) => {
  if (sourceUri === destinationUri) {
    return destinationUri;
  }

  await ensureParentDirectory(destinationUri);

  const existing = await FileSystem.getInfoAsync(destinationUri, { md5: true });
  if (existing.exists) {
    const source = await FileSystem.getInfoAsync(sourceUri, { md5: true });
    if (source.exists && source.md5 && existing.md5 === source.md5) {
      return destinationUri;
    }
    throw new Error("같은 사진 저장 경로에 다른 파일이 있습니다. 기존 사진을 보호하기 위해 저장을 중단했습니다.");
  }

  const temporaryUri = `${destinationUri}.${Math.random().toString(36).slice(2)}.migrating`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: temporaryUri });
    const conflict = await FileSystem.getInfoAsync(destinationUri);
    if (conflict.exists) {
      throw new Error("사진 저장 중 파일 경로가 중복되었습니다. 기존 파일을 유지합니다.");
    }
    await FileSystem.moveAsync({ from: temporaryUri, to: destinationUri });
    return destinationUri;
  } finally {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
  }
};

export const getBodyFrameProjectPhotoUri = (projectId: string, photoId: string) =>
  absolutePath(buildProjectPhotoIdRelativePath(projectId, photoId));

export const getBodyFrameProjectPreviewUri = (projectId: string, photoId: string) =>
  absolutePath(buildProjectPreviewIdRelativePath(projectId, photoId));

export const createBodyFramePreview = async ({
  sourceUri,
  projectId,
  photoId,
  width,
  height
}: {
  sourceUri: string;
  projectId: string;
  photoId: string;
  width?: number | null;
  height?: number | null;
}) => {
  const destinationUri = getBodyFrameProjectPreviewUri(projectId, photoId);
  const maxEdge = Math.max(width ?? 0, height ?? 0);
  const scale =
    maxEdge > BODY_FRAME_MEDIA_POLICY.previewMaxLongSide
      ? BODY_FRAME_MEDIA_POLICY.previewMaxLongSide / maxEdge
      : 1;
  const resize =
    scale < 1
      ? {
          resize: {
            width: width ? Math.max(1, Math.round(width * scale)) : undefined,
            height: height ? Math.max(1, Math.round(height * scale)) : undefined
          }
        }
      : undefined;
  const result = await manipulateAsync(sourceUri, resize ? [resize] : [], {
    compress: BODY_FRAME_MEDIA_POLICY.previewJpegQuality,
    format: SaveFormat.JPEG
  });

  try {
    await replaceFileSafely(result.uri, destinationUri);
    return destinationUri;
  } finally {
    if (result.uri !== sourceUri && result.uri !== destinationUri) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    }
  }
};

export const storeBodyFramePhotoFile = async ({
  sourceUri,
  projectId,
  photoId,
  width,
  height
}: {
  sourceUri: string;
  projectId: string;
  photoId: string;
  width?: number | null;
  height?: number | null;
}) => {
  const optimized = await optimizeBodyFramePhotoForStorage({
    uri: sourceUri,
    width,
    height
  });
  const destinationUri = getBodyFrameProjectPhotoUri(projectId, photoId);

  try {
    await replaceFileSafely(optimized.uri, destinationUri);
    const previewUri = await createBodyFramePreview({
      sourceUri: destinationUri,
      projectId,
      photoId,
      width: optimized.width,
      height: optimized.height
    });

    return {
      uri: destinationUri,
      previewUri,
      width: optimized.width ?? width ?? 0,
      height: optimized.height ?? height ?? 0,
      imageQuality: optimized.imageQuality,
      optimizedQuality: optimized.quality,
      optimizedSize: optimized.size,
      originalSize: optimized.originalSize
    };
  } finally {
    if (optimized.uri !== sourceUri && optimized.uri !== destinationUri) {
      await FileSystem.deleteAsync(optimized.uri, { idempotent: true }).catch(() => undefined);
    }
  }
};

export type MigratedPhotoFileResult = {
  photo: PhotoItem;
  obsoleteSourceUris: string[];
};

export const migratePhotoFilesToProject = async (
  photo: PhotoItem & { projectId: string; sequence: number }
): Promise<MigratedPhotoFileResult> => {
  const obsoleteSourceUris: string[] = [];
  let nextUri = photo.uri;
  let nextPreviewUri = photo.previewUri;
  let nextLocalUri = photo.localUri;
  let nextLocalPreviewUri = photo.localPreviewUri;

  if (photo.localFileStatus !== "cloud_only" && !isRemoteUri(photo.uri)) {
    const destinationUri = getBodyFrameProjectPhotoUri(photo.projectId, photo.id);
    if (photo.uri !== destinationUri) {
      await replaceFileSafely(photo.uri, destinationUri);
      obsoleteSourceUris.push(photo.uri);
      nextUri = destinationUri;
      if (photo.localUri === photo.uri) {
        nextLocalUri = destinationUri;
      }
    }
  }

  if (photo.previewUri && !isRemoteUri(photo.previewUri)) {
    const destinationPreviewUri = getBodyFrameProjectPreviewUri(
      photo.projectId,
      photo.id
    );
    if (photo.previewUri !== destinationPreviewUri) {
      await replaceFileSafely(photo.previewUri, destinationPreviewUri);
      obsoleteSourceUris.push(photo.previewUri);
      nextPreviewUri = destinationPreviewUri;
      if (photo.localPreviewUri === photo.previewUri) {
        nextLocalPreviewUri = destinationPreviewUri;
      }
    }
  }

  return {
    photo: {
      ...photo,
      uri: nextUri,
      ...(nextPreviewUri ? { previewUri: nextPreviewUri } : {}),
      ...(nextLocalUri ? { localUri: nextLocalUri } : {}),
      ...(nextLocalPreviewUri ? { localPreviewUri: nextLocalPreviewUri } : {})
    },
    obsoleteSourceUris
  };
};

export const cleanupMigratedSourceFiles = async (uris: string[]) => {
  await Promise.all(
    [...new Set(uris)]
      .filter((uri) => !isRemoteUri(uri))
      .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))
  );
};
