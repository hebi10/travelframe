import {
  NativeModules,
  PermissionsAndroid,
  Platform
} from "react-native";

import { localStorageAdapter } from "@/lib/local-storage";

const PROJECT_REMINDER_STORAGE_KEY = "body-frame.project-reminders.v1";
const DEFAULT_PROJECT_REMINDER_HOUR = 20;
const DEFAULT_PROJECT_REMINDER_MINUTE = 0;
const POST_NOTIFICATIONS_PERMISSION =
  "android.permission.POST_NOTIFICATIONS" as Parameters<
    typeof PermissionsAndroid.request
  >[0];

type AndroidProjectReminderModule = {
  prepare: () => Promise<boolean>;
  scheduleDailyReminder: (
    projectId: string,
    projectName: string,
    hour: number,
    minute: number
  ) => Promise<boolean>;
  cancelReminder: (projectId: string) => Promise<boolean>;
};

export type ProjectReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

const nativeReminder = NativeModules.AndroidProjectReminder as
  | AndroidProjectReminderModule
  | undefined;

export const defaultProjectReminderSettings: ProjectReminderSettings = {
  enabled: false,
  hour: DEFAULT_PROJECT_REMINDER_HOUR,
  minute: DEFAULT_PROJECT_REMINDER_MINUTE
};

const clampReminderTime = (
  hour: unknown,
  minute: unknown
): Pick<ProjectReminderSettings, "hour" | "minute"> => ({
  hour:
    typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23
      ? hour
      : DEFAULT_PROJECT_REMINDER_HOUR,
  minute:
    typeof minute === "number" &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59
      ? minute
      : DEFAULT_PROJECT_REMINDER_MINUTE
});

const parseReminderMap = (
  value: string | null
): Record<string, ProjectReminderSettings> => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([projectId]) => projectId.trim().length > 0)
        .map(([projectId, raw]) => {
          const record =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)
              : {};
          const time = clampReminderTime(record.hour, record.minute);
          return [
            projectId,
            {
              enabled: record.enabled === true,
              ...time
            }
          ];
        })
    );
  } catch {
    return {};
  }
};

const writeReminderMap = async (
  reminders: Record<string, ProjectReminderSettings>
) => {
  await localStorageAdapter.setItem(
    PROJECT_REMINDER_STORAGE_KEY,
    JSON.stringify(reminders)
  );
};

export const getProjectReminderSettings = async (
  projectId: string
): Promise<ProjectReminderSettings> => {
  const reminders = parseReminderMap(
    await localStorageAdapter.getItem(PROJECT_REMINDER_STORAGE_KEY)
  );
  return reminders[projectId] ?? defaultProjectReminderSettings;
};

const ensureAndroidNotificationPermission = async () => {
  if (Platform.OS !== "android") {
    throw new Error("촬영 알림은 현재 Android에서만 지원합니다.");
  }

  if (!nativeReminder) {
    throw new Error("촬영 알림 모듈을 사용할 수 없습니다. 앱을 다시 설치해 주세요.");
  }

  await nativeReminder.prepare();

  if (Number(Platform.Version) < 33) {
    return;
  }

  const current = await PermissionsAndroid.check(POST_NOTIFICATIONS_PERMISSION);
  if (current) {
    return;
  }

  const result = await PermissionsAndroid.request(POST_NOTIFICATIONS_PERMISSION);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error(
      "촬영 알림을 사용하려면 알림 권한을 허용해 주세요."
    );
  }
};

export const updateProjectReminderSettings = async ({
  projectId,
  projectName,
  enabled,
  hour,
  minute
}: {
  projectId: string;
  projectName: string;
  enabled: boolean;
  hour: number;
  minute: number;
}) => {
  const time = clampReminderTime(hour, minute);
  const settings: ProjectReminderSettings = {
    enabled,
    ...time
  };

  if (enabled) {
    await ensureAndroidNotificationPermission();
    await nativeReminder!.scheduleDailyReminder(
      projectId,
      projectName,
      settings.hour,
      settings.minute
    );
  } else if (Platform.OS === "android" && nativeReminder) {
    await nativeReminder.cancelReminder(projectId);
  }

  const reminders = parseReminderMap(
    await localStorageAdapter.getItem(PROJECT_REMINDER_STORAGE_KEY)
  );
  reminders[projectId] = settings;
  await writeReminderMap(reminders);

  return settings;
};

export const cancelProjectReminder = async (projectId: string) => {
  if (Platform.OS === "android" && nativeReminder) {
    await nativeReminder.cancelReminder(projectId);
  }

  const reminders = parseReminderMap(
    await localStorageAdapter.getItem(PROJECT_REMINDER_STORAGE_KEY)
  );
  delete reminders[projectId];
  await writeReminderMap(reminders);
};

export const formatProjectReminderTime = ({
  hour,
  minute
}: Pick<ProjectReminderSettings, "hour" | "minute">) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export const parseProjectReminderTime = (
  value: string
): Pick<ProjectReminderSettings, "hour" | "minute"> | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
};
