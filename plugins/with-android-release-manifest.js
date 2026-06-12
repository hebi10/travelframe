const { withAndroidManifest } = require("@expo/config-plugins");

const OPTIONAL_ANDROID_FEATURES = [
  "android.hardware.camera",
  "android.hardware.microphone"
];

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

function withAndroidReleaseManifest(config) {
  return withAndroidManifest(config, (config) => {
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
}

module.exports = withAndroidReleaseManifest;
