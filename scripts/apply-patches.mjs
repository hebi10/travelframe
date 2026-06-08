import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const reactNativeVisionCameraRoot = path.join(
  root,
  "node_modules",
  "react-native-vision-camera"
);
const reactNativeGoogleMobileAdsRoot = path.join(
  root,
  "node_modules",
  "react-native-google-mobile-ads"
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);

function readFrom(packageRoot, relativePath) {
  return fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
}

function writeTo(packageRoot, relativePath, source) {
  fs.writeFileSync(path.join(packageRoot, relativePath), source);
}

function insertAfter(source, anchor, insertion) {
  if (source.includes(insertion.trim())) {
    return source;
  }

  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Patch anchor not found: ${anchor}`);
  }

  return `${source.slice(0, index + anchor.length)}${insertion}${source.slice(
    index + anchor.length
  )}`;
}

function replaceOptional(source, search, replacement) {
  if (source.includes(replacement.trim())) {
    return source;
  }

  if (!source.includes(search)) {
    return source;
  }

  return source.replace(search, replacement);
}

function replaceRequiredOneOf(source, label, variants) {
  if (variants.some(({ replacement }) => source.includes(replacement.trim()))) {
    return source;
  }

  const variant = variants.find(({ search }) => source.includes(search));
  if (!variant) {
    throw new Error(`${label} patch target not found`);
  }

  return source.replace(variant.search, variant.replacement);
}

function patchVisionCameraAndroidShutterSound() {
  if (!packageJson.dependencies?.["react-native-vision-camera"]) {
    console.info("react-native-vision-camera is not declared; skipping local VisionCamera patch");
    return;
  }

  if (!fs.existsSync(reactNativeVisionCameraRoot)) {
    console.info("react-native-vision-camera is not installed; skipping local VisionCamera patch");
    return;
  }

  const relativePath =
    "android/src/main/java/com/margelo/nitro/camera/hybrids/outputs/HybridPhotoOutput.kt";
  let source = readFrom(reactNativeVisionCameraRoot, relativePath);

  source = replaceRequiredOneOf(source, "VisionCamera Android shutter sound override", [
    {
      search:
        "      val enableShutterSound = (settings.enableShutterSound ?: true) || CameraInfo.mustPlayShutterSound()\n",
      replacement: "      val enableShutterSound = settings.enableShutterSound ?: true\n"
    },
    {
      search: `      val enableShutterSound =
        (settings.enableShutterSound ?: true) || CameraInfo.mustPlayShutterSound()
`,
      replacement: `      val enableShutterSound = settings.enableShutterSound ?: true
`
    }
  ]);
  source = replaceOptional(source, "import androidx.camera.core.CameraInfo\n", "");

  writeTo(reactNativeVisionCameraRoot, relativePath, source);
  console.info("applied local VisionCamera Android shutter sound patch");
}

function patchGoogleMobileAdsExpoConfig() {
  if (!packageJson.dependencies?.["react-native-google-mobile-ads"]) {
    console.info("react-native-google-mobile-ads is not declared; skipping local ads config patch");
    return;
  }

  if (!fs.existsSync(reactNativeGoogleMobileAdsRoot)) {
    console.info("react-native-google-mobile-ads is not installed; skipping local ads config patch");
    return;
  }

  const relativePath = "android/app-json.gradle";
  let source = readFrom(reactNativeGoogleMobileAdsRoot, relativePath);
  source = insertAfter(
    source,
    `  try {
    json = new JsonSlurper().parseText(jsonFile.text)
  } catch (Exception ignored) {
    rootProject.logger.warn ":\${project.name} failed to parse \${fileName} found at \${jsonFile.toString()}."
    rootProject.logger.warn ignored.toString()
  }
`,
    `
  if (json && !json[jsonRoot] && json.expo?.plugins instanceof List) {
    def expoGoogleMobileAdsPlugin = json.expo.plugins.find { plugin ->
      plugin instanceof List && plugin.size() > 1 && plugin[0] == jsonRoot
    }
    if (expoGoogleMobileAdsPlugin && expoGoogleMobileAdsPlugin[1] instanceof Map) {
      def pluginConfig = expoGoogleMobileAdsPlugin[1]
      json[jsonRoot] = [
        android_app_id: pluginConfig.androidAppId,
        delay_app_measurement_init: pluginConfig.delayAppMeasurementInit,
        optimize_initialization: pluginConfig.optimizeInitialization,
        optimize_ad_loading: pluginConfig.optimizeAdLoading
      ].findAll { entry -> entry.value != null }
    }
  }
`
  );

  writeTo(reactNativeGoogleMobileAdsRoot, relativePath, source);
  console.info("applied local Google Mobile Ads Expo config patch");
}

patchVisionCameraAndroidShutterSound();
patchGoogleMobileAdsExpoConfig();
