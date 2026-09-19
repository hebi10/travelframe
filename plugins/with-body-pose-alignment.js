const fs = require("fs");
const path = require("path");
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication
} = require("@expo/config-plugins");

const ML_KIT_POSE_DEPENDENCY =
  'implementation("com.google.mlkit:pose-detection:18.0.0-beta5")';
const DEFAULT_ANDROID_PACKAGE = "com.haebi.photoguide";

const PACKAGE_FILE = "AndroidPoseAlignmentPackage.kt";
const MODULE_FILE = "AndroidPoseAlignmentModule.kt";

function getAndroidPackage(config) {
  return config.android?.package ?? DEFAULT_ANDROID_PACKAGE;
}

function getAndroidPackageDirectory(androidPackage) {
  return androidPackage.replaceAll(".", path.sep);
}

function createPackageSource(androidPackage) {
  return `package ${androidPackage}.pose

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AndroidPoseAlignmentPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(AndroidPoseAlignmentModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
`;
}

function createModuleSource(androidPackage) {
  return `package ${androidPackage}.pose

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import java.io.File
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.hypot

class AndroidPoseAlignmentModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val detector = PoseDetection.getClient(
    PoseDetectorOptions.Builder()
      .setDetectorMode(PoseDetectorOptions.STREAM_MODE)
      .build()
  )

  override fun getName(): String = "AndroidPoseAlignment"

  @ReactMethod
  fun analyzePose(uri: String, promise: Promise) {
    try {
      val parsedUri =
        if (uri.contains("://")) Uri.parse(uri) else Uri.fromFile(File(uri))
      val image = InputImage.fromFilePath(reactContext, parsedUri)

      detector.process(image)
        .addOnSuccessListener { pose ->
          promise.resolve(createResult(pose, image.width, image.height))
        }
        .addOnFailureListener { error ->
          promise.reject("pose_detection_failed", error)
        }
    } catch (error: Exception) {
      promise.reject("pose_input_failed", error)
    }
  }

  private fun createResult(
    pose: Pose,
    imageWidth: Int,
    imageHeight: Int
  ): WritableNativeMap {
    val width = imageWidth.coerceAtLeast(1).toFloat()
    val height = imageHeight.coerceAtLeast(1).toFloat()

    val leftShoulder = pose.getPoseLandmark(PoseLandmark.LEFT_SHOULDER)
    val rightShoulder = pose.getPoseLandmark(PoseLandmark.RIGHT_SHOULDER)
    val leftHip = pose.getPoseLandmark(PoseLandmark.LEFT_HIP)
    val rightHip = pose.getPoseLandmark(PoseLandmark.RIGHT_HIP)
    val leftAnkle = pose.getPoseLandmark(PoseLandmark.LEFT_ANKLE)
    val rightAnkle = pose.getPoseLandmark(PoseLandmark.RIGHT_ANKLE)

    val core = listOf(leftShoulder, rightShoulder, leftHip, rightHip)
    val detected = core.all { landmark ->
      landmark != null && landmark.inFrameLikelihood >= 0.55f
    }
    val fullBodyDetected =
      detected &&
        leftAnkle != null &&
        rightAnkle != null &&
        leftAnkle.inFrameLikelihood >= 0.55f &&
        rightAnkle.inFrameLikelihood >= 0.55f

    val result = WritableNativeMap()
    if (!detected) {
      result.putBoolean("detected", false)
      result.putBoolean("fullBodyDetected", false)
      result.putDouble("confidence", core.mapNotNull { it?.inFrameLikelihood?.toDouble() }.averageOrZero())
      result.putDouble("centerX", 0.0)
      result.putDouble("centerY", 0.0)
      result.putDouble("bodyHeight", 0.0)
      result.putDouble("shoulderWidth", 0.0)
      result.putDouble("shoulderTiltDegrees", 0.0)
      return result
    }

    val shoulderCenterX =
      (leftShoulder!!.position.x + rightShoulder!!.position.x) / 2f
    val shoulderCenterY =
      (leftShoulder.position.y + rightShoulder.position.y) / 2f
    val hipCenterX = (leftHip!!.position.x + rightHip!!.position.x) / 2f
    val hipCenterY = (leftHip.position.y + rightHip.position.y) / 2f

    val shoulderWidth = hypot(
      (rightShoulder.position.x - leftShoulder.position.x).toDouble(),
      (rightShoulder.position.y - leftShoulder.position.y).toDouble()
    ) / width

    val bodyHeight =
      if (fullBodyDetected) {
        val ankleCenterX = (leftAnkle!!.position.x + rightAnkle!!.position.x) / 2f
        val ankleCenterY = (leftAnkle.position.y + rightAnkle.position.y) / 2f
        hypot(
          (ankleCenterX - shoulderCenterX).toDouble(),
          (ankleCenterY - shoulderCenterY).toDouble()
        ) / height
      } else {
        0.0
      }

    val shoulderTiltDegrees =
      atan2(
        (rightShoulder.position.y - leftShoulder.position.y).toDouble(),
        (rightShoulder.position.x - leftShoulder.position.x).toDouble()
      ) * 180.0 / PI

    val confidenceLandmarks = mutableListOf(
      leftShoulder.inFrameLikelihood.toDouble(),
      rightShoulder.inFrameLikelihood.toDouble(),
      leftHip.inFrameLikelihood.toDouble(),
      rightHip.inFrameLikelihood.toDouble()
    )
    if (fullBodyDetected) {
      confidenceLandmarks.add(leftAnkle!!.inFrameLikelihood.toDouble())
      confidenceLandmarks.add(rightAnkle!!.inFrameLikelihood.toDouble())
    }

    result.putBoolean("detected", true)
    result.putBoolean("fullBodyDetected", fullBodyDetected)
    result.putDouble("confidence", confidenceLandmarks.averageOrZero())
    result.putDouble("centerX", ((shoulderCenterX + hipCenterX) / 2f / width).toDouble())
    result.putDouble("centerY", ((shoulderCenterY + hipCenterY) / 2f / height).toDouble())
    result.putDouble("bodyHeight", bodyHeight)
    result.putDouble("shoulderWidth", shoulderWidth)
    result.putDouble("shoulderTiltDegrees", shoulderTiltDegrees)
    return result
  }

  private fun List<Double>.averageOrZero(): Double =
    if (isEmpty()) 0.0 else average()

  override fun invalidate() {
    detector.close()
    super.invalidate()
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
    `import ${androidPackage}.pose.AndroidPoseAlignmentPackage`
  );

  if (updated.includes("add(AndroidPoseAlignmentPackage())")) {
    return updated;
  }

  const packageListApplyPattern = /(PackageList\(this\)\.packages\.apply\s*\{\s*)/;
  if (!packageListApplyPattern.test(updated)) {
    throw new Error("Could not locate MainApplication PackageList registration block.");
  }

  return updated.replace(
    packageListApplyPattern,
    "$1          add(AndroidPoseAlignmentPackage())\n"
  );
}

function writePoseFiles(config) {
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
    "pose"
  );

  fs.mkdirSync(moduleDirectory, { recursive: true });
  fs.writeFileSync(path.join(moduleDirectory, PACKAGE_FILE), createPackageSource(androidPackage));
  fs.writeFileSync(path.join(moduleDirectory, MODULE_FILE), createModuleSource(androidPackage));
}

function withBodyPoseAlignment(config) {
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(ML_KIT_POSE_DEPENDENCY)) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${ML_KIT_POSE_DEPENDENCY}`
      );
    }
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    (config) => {
      if (!config.modRequest.introspect) {
        writePoseFiles(config);
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

module.exports = withBodyPoseAlignment;
