const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication
} = require("@expo/config-plugins");

const DEFAULT_ANDROID_PACKAGE = "com.haebi.photoguide";
const PACKAGE_FILE = "AndroidProjectReminderPackage.kt";
const MODULE_FILE = "AndroidProjectReminderModule.kt";
const RECEIVER_FILE = "ProjectReminderReceiver.kt";

function getAndroidPackage(config) {
  return config.android?.package ?? DEFAULT_ANDROID_PACKAGE;
}

function getAndroidPackageDirectory(androidPackage) {
  return androidPackage.replaceAll(".", path.sep);
}

function ensurePermission(manifest, permissionName) {
  const usesPermissions = manifest.manifest["uses-permission"] ?? [];
  if (!usesPermissions.some((entry) => entry?.$?.["android:name"] === permissionName)) {
    usesPermissions.push({ $: { "android:name": permissionName } });
  }
  manifest.manifest["uses-permission"] = usesPermissions;
}

function ensureReceiver(manifest, androidPackage) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const receivers = application.receiver ?? [];
  const receiverName = `${androidPackage}.reminder.ProjectReminderReceiver`;
  let receiver = receivers.find((entry) => entry?.$?.["android:name"] === receiverName);

  if (!receiver) {
    receiver = {
      $: {
        "android:name": receiverName,
        "android:enabled": "true",
        "android:exported": "false"
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
            { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } }
          ]
        }
      ]
    };
    receivers.push(receiver);
  }

  application.receiver = receivers;
}

function createPackageSource(androidPackage) {
  return `package ${androidPackage}.reminder

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AndroidProjectReminderPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(AndroidProjectReminderModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
`;
}

function createModuleSource(androidPackage) {
  return `package ${androidPackage}.reminder

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AndroidProjectReminderModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AndroidProjectReminder"

  @ReactMethod
  fun prepare(promise: Promise) {
    try {
      ProjectReminderScheduler.ensureNotificationChannel(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("project_reminder_prepare_failed", error)
    }
  }

  @ReactMethod
  fun scheduleDailyReminder(
    projectId: String,
    projectName: String,
    hour: Int,
    minute: Int,
    promise: Promise
  ) {
    try {
      ProjectReminderScheduler.saveAndSchedule(
        reactApplicationContext,
        projectId,
        projectName,
        hour,
        minute
      )
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("project_reminder_schedule_failed", error)
    }
  }

  @ReactMethod
  fun cancelReminder(projectId: String, promise: Promise) {
    try {
      ProjectReminderScheduler.cancel(
        reactApplicationContext,
        projectId,
        removeStoredSettings = true
      )
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("project_reminder_cancel_failed", error)
    }
  }
}
`;
}

function createReceiverSource(androidPackage) {
  return `package ${androidPackage}.reminder

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.util.Calendar

private const val CHANNEL_ID = "body_frame_project_reminders"
private const val CHANNEL_NAME = "프로젝트 촬영 알림"
private const val PREFS_NAME = "body_frame_project_reminders"
private const val PROJECT_IDS_KEY = "project_ids"
private const val EXTRA_PROJECT_ID = "project_id"
private const val EXTRA_PROJECT_NAME = "project_name"

object ProjectReminderScheduler {
  fun ensureNotificationChannel(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "프로젝트별 매일 촬영 시간을 알려줍니다."
      enableVibration(true)
    }
    manager.createNotificationChannel(channel)
  }

  fun saveAndSchedule(
    context: Context,
    projectId: String,
    projectName: String,
    hour: Int,
    minute: Int
  ) {
    require(projectId.isNotBlank()) { "projectId is required" }
    require(hour in 0..23) { "hour must be between 0 and 23" }
    require(minute in 0..59) { "minute must be between 0 and 59" }

    ensureNotificationChannel(context)

    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val ids = prefs.getStringSet(PROJECT_IDS_KEY, emptySet())?.toMutableSet() ?: mutableSetOf()
    ids.add(projectId)
    prefs.edit()
      .putStringSet(PROJECT_IDS_KEY, ids)
      .putString("name_$projectId", projectName.ifBlank { "바디 프레임" })
      .putInt("hour_$projectId", hour)
      .putInt("minute_$projectId", minute)
      .apply()

    schedule(context, projectId, projectName, hour, minute)
  }

  fun schedule(
    context: Context,
    projectId: String,
    projectName: String,
    hour: Int,
    minute: Int
  ) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val trigger = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      if (timeInMillis <= System.currentTimeMillis()) {
        add(Calendar.DAY_OF_YEAR, 1)
      }
    }

    alarmManager.setAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      trigger.timeInMillis,
      createPendingIntent(context, projectId, projectName)
    )
  }

  fun cancel(context: Context, projectId: String, removeStoredSettings: Boolean) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(createPendingIntent(context, projectId, ""))

    if (removeStoredSettings) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val ids = prefs.getStringSet(PROJECT_IDS_KEY, emptySet())?.toMutableSet() ?: mutableSetOf()
      ids.remove(projectId)
      prefs.edit()
        .putStringSet(PROJECT_IDS_KEY, ids)
        .remove("name_$projectId")
        .remove("hour_$projectId")
        .remove("minute_$projectId")
        .apply()
    }
  }

  fun restoreAll(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val ids = prefs.getStringSet(PROJECT_IDS_KEY, emptySet()) ?: emptySet()
    ids.forEach { projectId ->
      val projectName = prefs.getString("name_$projectId", "바디 프레임") ?: "바디 프레임"
      val hour = prefs.getInt("hour_$projectId", 20)
      val minute = prefs.getInt("minute_$projectId", 0)
      schedule(context, projectId, projectName, hour, minute)
    }
  }

  private fun createPendingIntent(
    context: Context,
    projectId: String,
    projectName: String
  ): PendingIntent {
    val intent = Intent(context, ProjectReminderReceiver::class.java).apply {
      action = "bodyframe.project.reminder.$projectId"
      putExtra(EXTRA_PROJECT_ID, projectId)
      putExtra(EXTRA_PROJECT_NAME, projectName)
    }
    return PendingIntent.getBroadcast(
      context,
      projectId.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}

class ProjectReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (
      intent.action == Intent.ACTION_BOOT_COMPLETED ||
      intent.action == Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      ProjectReminderScheduler.restoreAll(context)
      return
    }

    val projectId = intent.getStringExtra(EXTRA_PROJECT_ID) ?: return
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val projectName =
      prefs.getString("name_$projectId", intent.getStringExtra(EXTRA_PROJECT_NAME))
        ?: "바디 프레임"
    val hour = prefs.getInt("hour_$projectId", 20)
    val minute = prefs.getInt("minute_$projectId", 0)

    ProjectReminderScheduler.ensureNotificationChannel(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        projectId.hashCode(),
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val notification = Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentTitle("$projectName 촬영 시간")
      .setContentText("오늘의 사진을 기록할 시간입니다.")
      .setAutoCancel(true)
      .setContentIntent(contentIntent)
      .build()

    if (
      Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
    ) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(projectId.hashCode(), notification)
    }

    ProjectReminderScheduler.schedule(context, projectId, projectName, hour, minute)
  }
}
`;
}

function ensureKotlinImport(source, importLine) {
  if (source.includes(importLine)) return source;

  const imports = [...source.matchAll(/^import .*$/gm)];
  if (imports.length > 0) {
    const lastImport = imports.at(-1);
    const insertIndex = lastImport.index + lastImport[0].length;
    return `${source.slice(0, insertIndex)}\n${importLine}${source.slice(insertIndex)}`;
  }

  return source.replace(/^(package .+)$/m, `$1\n\n${importLine}`);
}

function ensurePackageRegistered(source, androidPackage) {
  let updated = ensureKotlinImport(
    source,
    `import ${androidPackage}.reminder.AndroidProjectReminderPackage`
  );

  if (updated.includes("add(AndroidProjectReminderPackage())")) {
    return updated;
  }

  const packageListApplyPattern = /(PackageList\(this\)\.packages\.apply\s*\{\s*)/;
  if (!packageListApplyPattern.test(updated)) {
    throw new Error("Could not locate MainApplication PackageList registration block.");
  }

  return updated.replace(
    packageListApplyPattern,
    "$1          add(AndroidProjectReminderPackage())\n"
  );
}

function writeReminderFiles(config) {
  const androidPackage = getAndroidPackage(config);
  const platformProjectRoot =
    config.modRequest.platformProjectRoot ??
    path.join(config.modRequest.projectRoot, "android");
  const moduleDirectory = path.join(
    platformProjectRoot,
    "app",
    "src",
    "main",
    "java",
    getAndroidPackageDirectory(androidPackage),
    "reminder"
  );

  fs.mkdirSync(moduleDirectory, { recursive: true });
  fs.writeFileSync(path.join(moduleDirectory, PACKAGE_FILE), createPackageSource(androidPackage));
  fs.writeFileSync(path.join(moduleDirectory, MODULE_FILE), createModuleSource(androidPackage));
  fs.writeFileSync(path.join(moduleDirectory, RECEIVER_FILE), createReceiverSource(androidPackage));
}

function withProjectReminder(config) {
  config = withAndroidManifest(config, (config) => {
    ensurePermission(config.modResults, "android.permission.POST_NOTIFICATIONS");
    ensurePermission(config.modResults, "android.permission.RECEIVE_BOOT_COMPLETED");
    ensureReceiver(config.modResults, getAndroidPackage(config));
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    (config) => {
      if (!config.modRequest.introspect) {
        writeReminderFiles(config);
      }
      return config;
    }
  ]);

  config = withMainApplication(config, (config) => {
    config.modResults.contents = ensurePackageRegistered(
      config.modResults.contents,
      getAndroidPackage(config)
    );
    return config;
  });

  return config;
}

module.exports = withProjectReminder;
