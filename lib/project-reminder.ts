import {
  NativeModules,
  PermissionsAndroid,
  Platform
} from "react-native";

import { localStorageAdapter } from "@/lib/local-storage";

const PROJECT_REMINDER_STORAGE_KEY = "body-frame.project-reminders.v1";
const DEFAULT_PROJECT_REMINDER_HOUR = 20;
const DEFAULT_PROJECT_REMINDER_MINUTE = 0;
export const DEFAULT_PROJECT_REMINDER_MESSAGE = "오늘 사진을 기록할 시간입니다.";
const MAX_PROJECT_REMINDER_MESSAGE_LENGTH = 80;
const ALL_PROJECT_REMINDER_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const POST_NOTIFICATIONS_PERMISSION =
  "android.permission.POST_NOTIFICATIONS" as Parameters<
    typeof PermissionsAndroid.request
  >[0];

export type ProjectReminderRepeatMode = "daily" | "selected";
export type ProjectReminderWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const PROJECT_REMINDER_WEEKDAY_OPTIONS: Array<{
  label: string;
  value: ProjectReminderWeekday;
}> = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 0 }
];

type AndroidProjectReminderModule = {
  prepare: () => Promise<boolean>;
  scheduleReminder: (
    projectId: string,
    projectName: string,
    notificationMessage: string,
    hour: number,
    minute: number,
    weekdaysCsv: string
  ) => Promise<boolean>;
  cancelReminder: (projectId: string) => Promise<boolean>;
};

export type ProjectReminderSettings = {
  enabled: boolean;
  message: string;
  hour: number;
  minute: number;
  repeatMode: ProjectReminderRepeatMode;
  weekdays: ProjectReminderWeekday[];
};

const nativeReminder = NativeModules.AndroidProjectReminder as
  | AndroidProjectReminderModule
  | undefined;

export const defaultProjectReminderSettings: ProjectReminderSettings = {
  enabled: false,
  message: DEFAULT_PROJECT_REMINDER_MESSAGE,
  hour: DEFAULT_PROJECT_REMINDER_HOUR,
  minute: DEFAULT_PROJECT_REMINDER_MINUTE,
  repeatMode: "daily",
  weekdays: [...ALL_PROJECT_REMINDER_WEEKDAYS]
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

const normalizeReminderMessage = (value: unknown) => {
  if (typeof value !== "string") {
    return DEFAULT_PROJECT_REMINDER_MESSAGE;
  }

  const normalized = value.trim().slice(0, MAX_PROJECT_REMINDER_MESSAGE_LENGTH);
  return normalized || DEFAULT_PROJECT_REMINDER_MESSAGE;
};

const normalizeWeekdays = (value: unknown): ProjectReminderWeekday[] => {
  if (!Array.isArray(value)) {
    return [...ALL_PROJECT_REMINDER_WEEKDAYS];
  }

  const weekdays = [...new Set(
    value.filter(
      (item): item is ProjectReminderWeekday =>
        typeof item === "number" &&
        Number.isInteger(item) &&
        item >= 0 &&
        item <= 6
    )
  )].sort((a, b) => a - b);

  return weekdays.length > 0
    ? weekdays
    : [...ALL_PROJECT_REMINDER_WEEKDAYS];
};

const getScheduledWeekdays = ({
  repeatMode,
  weekdays
}: Pick<ProjectReminderSettings, "repeatMode" | "weekdays">) =>
  repeatMode === "daily"
    ? [...ALL_PROJECT_REMINDER_WEEKDAYS]
    : normalizeWeekdays(weekdays);

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
          const repeatMode: ProjectReminderRepeatMode =
            record.repeatMode === "selected" ? "selected" : "daily";
          const weekdays = normalizeWeekdays(record.weekdays);

          return [
            projectId,
            {
              enabled: record.enabled === true,
              message: normalizeReminderMessage(record.message),
              ...time,
              repeatMode,
              weekdays:
                repeatMode === "daily"
                  ? [...ALL_PROJECT_REMINDER_WEEKDAYS]
                  : weekdays
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

const scheduleNativeProjectReminder = async ({
  projectId,
  projectName,
  settings
}: {
  projectId: string;
  projectName: string;
  settings: ProjectReminderSettings;
}) => {
  if (Platform.OS !== "android" || !nativeReminder || !settings.enabled) {
    return;
  }

  const weekdays = getScheduledWeekdays(settings);
  await nativeReminder.scheduleReminder(
    projectId,
    projectName,
    settings.message,
    settings.hour,
    settings.minute,
    weekdays.join(",")
  );
};

export const updateProjectReminderSettings = async ({
  projectId,
  projectName,
  enabled,
  message,
  hour,
  minute,
  repeatMode,
  weekdays
}: {
  projectId: string;
  projectName: string;
  enabled: boolean;
  message: string;
  hour: number;
  minute: number;
  repeatMode: ProjectReminderRepeatMode;
  weekdays: ProjectReminderWeekday[];
}) => {
  const time = clampReminderTime(hour, minute);
  const normalizedWeekdays = normalizeWeekdays(weekdays);
  const settings: ProjectReminderSettings = {
    enabled,
    message: normalizeReminderMessage(message),
    ...time,
    repeatMode,
    weekdays:
      repeatMode === "daily"
        ? [...ALL_PROJECT_REMINDER_WEEKDAYS]
        : normalizedWeekdays
  };

  if (enabled) {
    await ensureAndroidNotificationPermission();
    await scheduleNativeProjectReminder({
      projectId,
      projectName,
      settings
    });
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

export const syncProjectReminderProjectName = async ({
  projectId,
  projectName,
  settings
}: {
  projectId: string;
  projectName: string;
  settings: ProjectReminderSettings;
}) => {
  await scheduleNativeProjectReminder({
    projectId,
    projectName,
    settings
  });
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

export const formatProjectReminderDays = ({
  repeatMode,
  weekdays
}: Pick<ProjectReminderSettings, "repeatMode" | "weekdays">) => {
  if (repeatMode === "daily") {
    return "매일";
  }

  const selected = new Set(weekdays);
  return PROJECT_REMINDER_WEEKDAY_OPTIONS
    .filter(({ value }) => selected.has(value))
    .map(({ label }) => label)
    .join("·");
};

export const formatProjectReminderSchedule = (
  settings: ProjectReminderSettings
) =>
  `${formatProjectReminderDays(settings)} ${formatProjectReminderTime(settings)}`;

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
