export const CAMERA_CAPTURE_TIMEOUT_MESSAGE = "카메라 촬영 응답이 지연되어 다시 연결합니다. 연결 후 다시 촬영해주세요.";

export class CameraCaptureTimeoutError extends Error {
  constructor() {
    super(CAMERA_CAPTURE_TIMEOUT_MESSAGE);
    this.name = "CameraCaptureTimeoutError";
  }
}

// A timeout cannot cancel CameraX. Consume late results without saving them as
// another capture, and clean up any file that arrives after the session resets.
export function waitForCameraCapture<T>(
  capture: Promise<T>,
  cleanupLateResult: (result: T) => Promise<unknown>,
  timeoutMs = 15_000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new CameraCaptureTimeoutError());
    }, timeoutMs);
    capture.then(result => {
      if (settled) {
        void Promise.resolve().then(() => cleanupLateResult(result)).catch(() => undefined);
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }, error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}
