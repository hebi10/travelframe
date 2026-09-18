import {
  defaultAppSettings,
  type AppSettings
} from "@/lib/app-settings";
import { localStorageAdapter } from "@/lib/local-storage";
import {
  defaultBodyCaptureContextState,
  type BodyCaptureContext,
  type BodyCaptureContextState
} from "@/types/body-capture-context";
import type { PhotoRatioLabel } from "@/types/photo";

export const BODY_CAPTURE_CONTEXT_STORAGE_KEY = [
  "body",
  "frame",
  "capture",
  "context",
  "v1"
].join(".");

const cameraRatios: PhotoRatioLabel[] = [
  "1:1",
  "3:4",
  "4:3",
  "4:5",
  "9:16",
  "16:9"
];

let mutationChain = Promise.resolve();

const runMutation = async <T>(operation: () => Promise<T>) => {
  const run = mutationChain.then(operation, operation);
  mutationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

export const createBodyCaptureContextFromAppSettings = (
  settings: AppSettings
): BodyCaptureContext => ({
  cameraFacing:
    settings.cameraFacing === "front" ? "front" : defaultAppSettings.cameraFacing,
  cameraRatio: cameraRatios.includes(settings.cameraRatio)
    ? settings.cameraRatio
    : defaultAppSettings.cameraRatio,
  cameraZoomPercent: Math.round(
    clamp(settings.cameraZoomPercent, 0, 100, defaultAppSettings.cameraZoomPercent)
  ),
  cameraExposureBias: Number(
    clamp(
      settings.cameraExposureBias,
      -1,
      1,
      defaultAppSettings.cameraExposureBias
    ).toFixed(2)
  ),
  cameraColorTemperature: Math.round(
    clamp(
      settings.cameraColorTemperature,
      -100,
      100,
      defaultAppSettings.cameraColorTemperature
    )
  ),
  cameraColorTint: Math.round(
    clamp(
      settings.cameraColorTint,
      -100,
      100,
      defaultAppSettings.cameraColorTint
    )
  ),
  cameraBrightness: Math.round(
    clamp(settings.cameraBrightness, -100, 100, defaultAppSettings.cameraBrightness)
  ),
  cameraContrast: Math.round(
    clamp(settings.cameraContrast, -100, 100, defaultAppSettings.cameraContrast)
  ),
  cameraSaturation: Math.round(
    clamp(
      settings.cameraSaturation,
      -100,
      100,
      defaultAppSettings.cameraSaturation
    )
  )
});

export const normalizeBodyCaptureContext = (
  value: unknown
): BodyCaptureContext | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Partial<BodyCaptureContext>;
  return createBodyCaptureContextFromAppSettings({
    ...defaultAppSettings,
    ...record,
    cameraFacing:
      record.cameraFacing === "front" || record.cameraFacing === "back"
        ? record.cameraFacing
        : defaultAppSettings.cameraFacing,
    cameraRatio:
      typeof record.cameraRatio === "string" &&
      cameraRatios.includes(record.cameraRatio as PhotoRatioLabel)
        ? (record.cameraRatio as PhotoRatioLabel)
        : defaultAppSettings.cameraRatio
  });
};

const normalizeState = (value: unknown): BodyCaptureContextState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultBodyCaptureContextState;
  }

  const record = value as Record<string, unknown>;
  const context = normalizeBodyCaptureContext(record.context);
  const updatedAt =
    typeof record.updatedAt === "string" &&
    Number.isFinite(new Date(record.updatedAt).getTime())
      ? record.updatedAt
      : undefined;

  return {
    enabled: record.enabled !== false,
    context,
    ...(updatedAt ? { updatedAt } : {})
  };
};

const readStateMap = async () => {
  const raw = await localStorageAdapter.getItem(BODY_CAPTURE_CONTEXT_STORAGE_KEY);
  if (!raw) return {} as Record<string, BodyCaptureContextState>;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([projectId, state]) => [
        projectId,
        normalizeState(state)
      ])
    );
  } catch {
    return {};
  }
};

const writeStateMap = async (map: Record<string, BodyCaptureContextState>) => {
  await localStorageAdapter.setItem(
    BODY_CAPTURE_CONTEXT_STORAGE_KEY,
    JSON.stringify(map)
  );
};

export const getBodyCaptureContextState = async (projectId: string) => {
  const map = await readStateMap();
  return map[projectId] ?? defaultBodyCaptureContextState;
};

export const updateBodyCaptureContextEnabled = async (
  projectId: string,
  enabled: boolean
) =>
  runMutation(async () => {
    const map = await readStateMap();
    const current = map[projectId] ?? defaultBodyCaptureContextState;
    const next: BodyCaptureContextState = {
      ...current,
      enabled,
      updatedAt: new Date().toISOString()
    };
    await writeStateMap({ ...map, [projectId]: next });
    return next;
  });

export const saveBodyCaptureContext = async (
  projectId: string,
  context: BodyCaptureContext
) =>
  runMutation(async () => {
    const map = await readStateMap();
    const current = map[projectId] ?? defaultBodyCaptureContextState;
    const next: BodyCaptureContextState = {
      ...current,
      context: normalizeBodyCaptureContext(context),
      updatedAt: new Date().toISOString()
    };
    await writeStateMap({ ...map, [projectId]: next });
    return next;
  });
