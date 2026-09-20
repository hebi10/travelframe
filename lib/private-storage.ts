import * as FileSystem from "expo-file-system/legacy";

import { firebaseAuth, firebaseStorage } from "@/lib/firebase";

const FIREBASE_STORAGE_HOST = "firebasestorage.googleapis.com";
const pending = new Map<string, Promise<string>>();

export const privateStorageUrl = (storagePath: string) => {
  const bucket = firebaseStorage?.app.options.storageBucket;
  if (!bucket) throw new Error("백업 저장소가 설정되지 않았습니다.");
  return `https://${FIREBASE_STORAGE_HOST}/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(storagePath)}?alt=media`;
};

// A token from our app must never be forwarded to arbitrary URLs in backup metadata.
const privateRequest = (uri: string) => {
  if (!/^https?:\/\//i.test(uri)) return null;
  const url = new URL(uri);
  if (url.hostname !== FIREBASE_STORAGE_HOST) return null;
  const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
  const user = firebaseAuth?.currentUser;
  const bucket = firebaseStorage?.app.options.storageBucket;
  if (url.protocol !== "https:" || url.port || url.username || url.password || !match || !user ||
      decodeURIComponent(match[1]) !== bucket) {
    throw new Error("이 백업 파일을 읽을 권한이 없습니다. 로그인 상태를 확인해 주세요.");
  }
  const path = decodeURIComponent(match[2]);
  if (!path.startsWith(`users/${user.uid}/`) || path.split("/").some(part => part === ".." || part === ".")) {
    throw new Error("다른 계정의 백업 파일은 열 수 없습니다.");
  }
  return { user, url: privateStorageUrl(path) };
};

export const getPrivateStorageHeaders = async (uri: string): Promise<Record<string, string>> => {
  const request = privateRequest(uri);
  if (!request) return {};
  const token = await request.user.getIdToken();
  if (firebaseAuth?.currentUser !== request.user) throw new Error("계정이 변경되었습니다. 다시 시도해 주세요.");
  return { Authorization: `Firebase ${token}` };
};

export const downloadPrivateFile = async (uri: string, destination: string) => {
  const request = privateRequest(uri);
  const headers = await getPrivateStorageHeaders(uri);
  const result = await FileSystem.downloadAsync(request?.url ?? uri, destination, { headers });
  if ((request && firebaseAuth?.currentUser !== request.user) || result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw new Error("백업 파일을 내려받지 못했습니다. 로그인과 네트워크 상태를 확인해 주세요.");
  }
  return result;
};

// Cache only display files. Durable library metadata keeps the authenticated remote URL.
export const resolvePrivateMediaUri = async (uri: string): Promise<string> => {
  const request = privateRequest(uri);
  if (!request) return uri;
  const key = `${request.user.uid}:${request.url}`;
  const existing = pending.get(key);
  if (existing) {
    const cached = await existing;
    if (firebaseAuth?.currentUser !== request.user) throw new Error("계정이 변경되었습니다.");
    if ((await FileSystem.getInfoAsync(cached)).exists) return cached;
    pending.delete(key);
  }
  const task = (async () => {
    if (!FileSystem.cacheDirectory) throw new Error("임시 저장소를 사용할 수 없습니다.");
    const directory = `${FileSystem.cacheDirectory}private-media/${encodeURIComponent(request.user.uid)}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const path = decodeURIComponent(new URL(request.url).pathname);
    const extension = /\.(jpg|jpeg|png|webp|mp4|mp3|m4a|aac|wav)$/i.exec(path)?.[1] ?? "bin";
    const destination = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    return (await downloadPrivateFile(request.url, destination)).uri;
  })();
  pending.set(key, task);
  try { return await task; } catch (error) { pending.delete(key); throw error; }
};
