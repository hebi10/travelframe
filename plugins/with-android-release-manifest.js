const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication
} = require("@expo/config-plugins");

const OPTIONAL_ANDROID_FEATURES = [
  "android.hardware.camera",
  "android.hardware.microphone"
];
const DEFAULT_ANDROID_PACKAGE = "com.haebi.photoguide";
const ANDROID_IMAGE_ADJUSTMENT_PACKAGE_FILE = "AndroidImageAdjustmentPackage.kt";
const ANDROID_IMAGE_ADJUSTMENT_MODULE_FILE = "AndroidImageAdjustmentModule.kt";

function createAndroidImageAdjustmentPackageSource(androidPackage) {
  return `package ${androidPackage}.image

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AndroidImageAdjustmentPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(AndroidImageAdjustmentModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
`;
}

function createAndroidImageAdjustmentModuleSource(androidPackage) {
  return `package ${androidPackage}.image

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

class AndroidImageAdjustmentModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AndroidImageAdjustment"

  @ReactMethod
  fun adjustImage(input: ReadableMap, promise: Promise) {
    try {
      val sourceUri = input.getString("uri")
      if (sourceUri.isNullOrBlank()) {
        promise.reject("invalid_uri", "Image URI is required.")
        return
      }

      val sourcePath = getPathFromUri(sourceUri)
      val sourceBitmap = BitmapFactory.decodeFile(sourcePath)
      if (sourceBitmap == null) {
        promise.reject("decode_failed", "Could not decode image.")
        return
      }

      val outputBitmap = Bitmap.createBitmap(
        sourceBitmap.width,
        sourceBitmap.height,
        Bitmap.Config.ARGB_8888
      )
      val canvas = Canvas(outputBitmap)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG)
      paint.colorFilter = ColorMatrixColorFilter(createColorMatrix(input))
      canvas.drawBitmap(sourceBitmap, 0f, 0f, paint)

      val outputFile = File(
        reactContext.cacheDir,
        "camera-color-adjusted-\${System.currentTimeMillis()}.jpg"
      )
      val quality = clamp(
        if (input.hasKey("quality")) input.getDouble("quality").toInt() else 95,
        1,
        100
      )
      FileOutputStream(outputFile).use { stream ->
        outputBitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
      }
      val outputWidth = outputBitmap.width
      val outputHeight = outputBitmap.height

      if (outputBitmap !== sourceBitmap) {
        outputBitmap.recycle()
      }
      sourceBitmap.recycle()

      val result = WritableNativeMap()
      result.putString("uri", Uri.fromFile(outputFile).toString())
      result.putInt("width", outputWidth)
      result.putInt("height", outputHeight)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("adjust_failed", error)
    }
  }

  private fun createColorMatrix(input: ReadableMap): ColorMatrix {
    val brightness = getAdjustment(input, "brightness")
    val contrast = getAdjustment(input, "contrast")
    val saturation = getAdjustment(input, "saturation")
    val temperature = getAdjustment(input, "temperature")
    val tint = getAdjustment(input, "tint")

    val saturationMatrix = ColorMatrix()
    saturationMatrix.setSaturation(max(0f, (saturation + 100f) / 100f))

    val contrastScale = max(0f, (contrast + 100f) / 100f)
    val brightnessOffset = brightness * 1.8f
    val contrastOffset = 128f * (1f - contrastScale)
    val redScale = 1f + temperature * 0.0032f + tint * 0.0016f
    val greenScale = 1f - tint * 0.0032f
    val blueScale = 1f - temperature * 0.0032f + tint * 0.0016f
    val colorMatrix = ColorMatrix(
      floatArrayOf(
        redScale * contrastScale, 0f, 0f, 0f, brightnessOffset + contrastOffset,
        0f, greenScale * contrastScale, 0f, 0f, brightnessOffset + contrastOffset,
        0f, 0f, blueScale * contrastScale, 0f, brightnessOffset + contrastOffset,
        0f, 0f, 0f, 1f, 0f
      )
    )

    saturationMatrix.postConcat(colorMatrix)
    return saturationMatrix
  }

  private fun getAdjustment(input: ReadableMap, key: String): Float {
    if (!input.hasKey(key)) {
      return 0f
    }

    return clamp(input.getDouble(key).toFloat(), -100f, 100f)
  }

  private fun getPathFromUri(uri: String): String {
    return if (uri.startsWith("file://")) {
      Uri.parse(uri).path ?: uri.removePrefix("file://")
    } else {
      uri
    }
  }

  private fun clamp(value: Float, minValue: Float, maxValue: Float): Float =
    max(minValue, min(maxValue, value))

  private fun clamp(value: Int, minValue: Int, maxValue: Int): Int =
    max(minValue, min(maxValue, value))
}
`;
}

function ensureOptionalFeature(androidManifest, featureName) {
  const features = androidManifest.manifest["uses-feature"] ?? [];
  const existingFeature = features.find(
    (feature) => feature?.$?.["android:name"] === featureName
  );

  if (existingFeature) {
    existingFeature.$["android:required"] = "false";
  } else {
    features.push({
      $: {
        "android:name": featureName,
        "android:required": "false"
      }
    });
  }

  androidManifest.manifest["uses-feature"] = features;
}

function getAndroidPackage(config) {
  return config.android?.package ?? DEFAULT_ANDROID_PACKAGE;
}

function getAndroidPackageDirectory(androidPackage) {
  return androidPackage.replaceAll(".", path.sep);
}

function writeAndroidImageAdjustmentFiles(config) {
  const androidPackage = getAndroidPackage(config);
  const androidPackageDirectory = getAndroidPackageDirectory(androidPackage);
  const platformProjectRoot =
    config.modRequest.platformProjectRoot ??
    path.join(config.modRequest.projectRoot, "android");
  const imageModuleDirectory = path.join(
    platformProjectRoot,
    "app",
    "src",
    "main",
    "java",
    androidPackageDirectory,
    "image"
  );
  const androidImageAdjustmentPackagePath = path.join(
    imageModuleDirectory,
    ANDROID_IMAGE_ADJUSTMENT_PACKAGE_FILE
  );
  const androidImageAdjustmentModulePath = path.join(
    imageModuleDirectory,
    ANDROID_IMAGE_ADJUSTMENT_MODULE_FILE
  );

  fs.mkdirSync(imageModuleDirectory, { recursive: true });
  fs.writeFileSync(
    androidImageAdjustmentPackagePath,
    createAndroidImageAdjustmentPackageSource(androidPackage)
  );
  fs.writeFileSync(
    androidImageAdjustmentModulePath,
    createAndroidImageAdjustmentModuleSource(androidPackage)
  );
}

function ensureKotlinImport(source, importLine) {
  if (source.includes(importLine)) {
    return source;
  }

  const imports = [...source.matchAll(/^import .*$/gm)];
  if (imports.length > 0) {
    const lastImport = imports.at(-1);
    const insertIndex = lastImport.index + lastImport[0].length;
    return `${source.slice(0, insertIndex)}\n${importLine}${source.slice(insertIndex)}`;
  }

  return source.replace(/^(package .+)$/m, `$1\n\n${importLine}`);
}

function ensureAndroidImageAdjustmentPackageRegistered(source, androidPackage) {
  let updatedSource = ensureKotlinImport(
    source,
    `import ${androidPackage}.image.AndroidImageAdjustmentPackage`
  );

  if (updatedSource.includes("add(AndroidImageAdjustmentPackage())")) {
    return updatedSource;
  }

  const packageListApplyPattern = /(PackageList\(this\)\.packages\.apply\s*\{\s*)/;
  if (!packageListApplyPattern.test(updatedSource)) {
    throw new Error("Could not locate MainApplication PackageList registration block.");
  }

  return updatedSource.replace(
    packageListApplyPattern,
    "$1          add(AndroidImageAdjustmentPackage())\n"
  );
}

function withAndroidReleaseManifest(config) {
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    for (const featureName of OPTIONAL_ANDROID_FEATURES) {
      ensureOptionalFeature(androidManifest, featureName);
    }

    const application = androidManifest.manifest.application?.[0]?.$;
    if (application) {
      delete application["android:requestLegacyExternalStorage"];
      const removeAttributes = new Set(
        (application["tools:remove"] ?? "")
          .split(",")
          .map((attribute) => attribute.trim())
          .filter(Boolean)
      );
      removeAttributes.add("android:requestLegacyExternalStorage");
      application["tools:remove"] = [...removeAttributes].join(",");
    }

    return config;
  });

  config = withDangerousMod(config, [
    "android",
    (config) => {
      if (!config.modRequest.introspect) {
        writeAndroidImageAdjustmentFiles(config);
      }

      return config;
    }
  ]);

  config = withMainApplication(config, (config) => {
    const androidPackage = getAndroidPackage(config);
    config.modResults.contents = ensureAndroidImageAdjustmentPackageRegistered(
      config.modResults.contents,
      androidPackage
    );

    return config;
  });

  return config;
}

module.exports = withAndroidReleaseManifest;
