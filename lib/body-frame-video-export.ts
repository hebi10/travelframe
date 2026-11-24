const cancelledError = () => new Error("영상 만들기가 취소되었습니다. 화면에서 다시 시도해 주세요.");
export const assertBodyFrameExportActive = (signal?: AbortSignal) => {
  if (signal?.aborted) throw cancelledError();
};

// Bound network/filesystem waits as well as display waits. Late native work may
// finish, but can never resume the cancelled export or report a successful save.
export const withBodyFrameExportTimeout = <T>(
  operation: Promise<T>,
  signal?: AbortSignal,
  timeoutMs = 30_000
): Promise<T> => new Promise((resolve, reject) => {
  const finish = (error?: Error, value?: T) => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (error) reject(error); else resolve(value as T);
  };
  const abort = () => finish(cancelledError());
  const timer = setTimeout(() => {
    const error = new Error("사진 준비 시간이 초과되었습니다. 원본 사진과 네트워크를 확인한 뒤 다시 시도해 주세요.");
    error.name = "BodyFrameExportTimeoutError";
    finish(error);
  }, timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });
  operation.then(value => finish(undefined, value), error => finish(error));
  if (signal?.aborted) abort();
});

const EXPORT_SPACE_MARGIN_BYTES = 32 * 1024 * 1024;

// Two video copies may coexist during recording and durable save. Include
// audio/encoder overhead; check actual free space again after staging.
export const getBodyFrameExportReserveBytes = (
  totalFrames: number,
  fps: number,
  bitrate: number
) => Math.ceil(totalFrames / fps * (bitrate + 256_000) / 8 * 2 * 1.25) + EXPORT_SPACE_MARGIN_BYTES;

export const assertBodyFrameExportSpace = (freeBytes: number, requiredBytes: number) => {
  if (!Number.isFinite(freeBytes) || freeBytes < requiredBytes) {
    const error = new Error("영상 만들기에 필요한 저장 공간이 부족하거나 확인할 수 없습니다. 기기 저장 공간을 확보한 뒤 다시 시도해 주세요.");
    error.name = "BodyFrameExportSpaceError";
    throw error;
  }
};

type StageFileInfo = { exists: boolean; isDirectory?: boolean; size?: number };
export const stageBodyFrameOriginalFile = async ({
  uri, destination, signal, reserveBytes, getInfo, getFreeBytes, copy, download, discard
}: {
  uri: string;
  destination: string;
  signal?: AbortSignal;
  reserveBytes: number;
  getInfo: (uri: string) => Promise<StageFileInfo>;
  getFreeBytes: () => Promise<number>;
  copy: (from: string, to: string) => Promise<unknown>;
  download: (from: string, to: string) => Promise<unknown>;
  discard: (uri: string) => Promise<unknown>;
}) => {
  let keep = false;
  try {
    assertBodyFrameExportActive(signal);
    const remote = /^https?:\/\//i.test(uri);
    const source = remote ? undefined : await getInfo(uri);
    assertBodyFrameExportActive(signal);
    if (source && (!source.exists || source.isDirectory || !(Number(source.size) > 0))) {
      throw new Error("원본 사진 파일을 찾지 못했습니다.");
    }
    assertBodyFrameExportSpace(await getFreeBytes(), reserveBytes + (source?.size ?? 0));
    assertBodyFrameExportActive(signal);
    if (remote) await download(uri, destination);
    else await copy(uri, destination);
    assertBodyFrameExportActive(signal);
    const info = await getInfo(destination);
    if (!info.exists || info.isDirectory || !(Number(info.size) > 0)) {
      throw new Error("원본 사진 파일이 비어 있습니다.");
    }
    assertBodyFrameExportSpace(await getFreeBytes(), reserveBytes);
    assertBodyFrameExportActive(signal);
    keep = true;
    return destination;
  } finally {
    // Native copy/download can settle after JS timeout or cancellation. Clean
    // its own destination again on settlement, never the original photo.
    if (!keep) await discard(destination).catch(() => undefined);
  }
};

export const prepareBodyFrameVideoPhotos = async <T extends {
  id: string; uri: string; localUri?: string; downloadURL?: string; previewUri?: string;
}>(
  photos: readonly T[],
  stageOriginal: (uri: string, photoId: string, attemptSignal: AbortSignal) => Promise<string>,
  signal?: AbortSignal,
  onProgress?: (prepared: number, total: number) => void,
  stageTimeoutMs = 30_000
): Promise<T[]> => {
  const prepared: T[] = [];
  for (const photo of photos) {
    assertBodyFrameExportActive(signal);
    const candidates = [...new Set([photo.localUri, photo.uri, photo.downloadURL].filter((uri): uri is string => Boolean(uri)))];
    let staged: string | null = null;
    for (const uri of candidates) {
      assertBodyFrameExportActive(signal);
      const attempt = new AbortController();
      try {
        staged = await withBodyFrameExportTimeout(stageOriginal(uri, photo.id, attempt.signal), signal, stageTimeoutMs);
        assertBodyFrameExportActive(signal);
        break;
      } catch (error) {
        attempt.abort();
        assertBodyFrameExportActive(signal);
        if (error instanceof Error &&
            (error.name === "BodyFrameExportTimeoutError" || error.name === "BodyFrameExportSpaceError")) throw error;
      }
    }
    if (!staged) throw new Error(`사진 원본을 확인하지 못했습니다 (#${prepared.length + 1}). 해당 사진을 열어 복원 상태와 네트워크를 확인한 뒤 다시 시도해 주세요.`);
    prepared.push({ ...photo, uri: staged, previewUri: staged });
    onProgress?.(prepared.length, photos.length);
  }
  return prepared;
};

export const createBodyFrameImageReadiness = (timeoutMs = 15_000) => {
  const states = new Map<string, "displayed" | "failed">();
  const listeners = new Map<string, Set<(state: "displayed" | "failed") => void>>();
  const notify = (key: string, state: "displayed" | "failed") => {
    states.set(key, state);
    listeners.get(key)?.forEach(listener => listener(state));
  };
  return {
    displayed: (key: string) => notify(key, "displayed"),
    failed: (key: string) => notify(key, "failed"),
    wait: (key: string, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        listeners.get(key)?.delete(complete);
      };
      const complete = (state: "displayed" | "failed") => {
        cleanup();
        if (state === "displayed") resolve();
        else reject(new Error("사진을 불러오지 못했습니다. 해당 원본 사진을 확인한 뒤 다시 시도해 주세요."));
      };
      const abort = () => { cleanup(); reject(cancelledError()); };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("사진 표시 시간이 초과되었습니다. 해당 사진을 열어 확인한 뒤 다시 시도해 주세요."));
      }, timeoutMs);
      signal?.addEventListener("abort", abort, { once: true });
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(complete);
      if (signal?.aborted) abort();
      else if (states.has(key)) complete(states.get(key)!);
    })
  };
};

// The optional recorder API exposes record(), but no stop()/release(). Keep a
// process-wide guard across screen remounts and do not release staged files when
// only our JS timeout/abort has settled. Native settlement is the release point.
let nativeRecordingActive = false;
export const runBodyFrameNativeRecording = async <T>(
  start: () => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = 60_000
): Promise<T> => {
  if (nativeRecordingActive) throw new Error("이전 영상 작업이 종료되는 중입니다. 잠시 후 다시 시도해 주세요.");
  assertBodyFrameExportActive(signal);
  nativeRecordingActive = true;
  let recording: Promise<T> | undefined;
  try {
    recording = start();
    return await withBodyFrameExportTimeout(recording, signal, timeoutMs);
  } catch (error) {
    // A rejected callback may stop the native loop, but that is not proof that
    // its encoder resources have been released. Await the actual record promise.
    await recording?.catch(() => undefined);
    throw error;
  } finally {
    nativeRecordingActive = false;
  }
};
