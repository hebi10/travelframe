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

export const prepareBodyFrameVideoPhotos = async <T extends {
  id: string; uri: string; localUri?: string; downloadURL?: string; previewUri?: string;
}>(
  photos: readonly T[],
  stageOriginal: (uri: string, photoId: string) => Promise<string>,
  signal?: AbortSignal,
  onProgress?: (prepared: number, total: number) => void
): Promise<T[]> => {
  const prepared: T[] = [];
  for (const photo of photos) {
    assertBodyFrameExportActive(signal);
    const candidates = [...new Set([photo.localUri, photo.uri, photo.downloadURL].filter((uri): uri is string => Boolean(uri)))];
    let staged: string | null = null;
    for (const uri of candidates) {
      assertBodyFrameExportActive(signal);
      try {
        staged = await withBodyFrameExportTimeout(stageOriginal(uri, photo.id), signal);
        assertBodyFrameExportActive(signal);
        break;
      } catch (error) {
        assertBodyFrameExportActive(signal);
        if (error instanceof Error && error.name === "BodyFrameExportTimeoutError") throw error;
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
