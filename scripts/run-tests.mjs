import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const testsDirectory = path.join(root, "tests");
const filters = process.argv.slice(2).map((value) => value.toLowerCase());
const defaultExcludedTests = new Set(["firebase-rules-emulator.test.mjs"]);
const TEST_TIMEOUT_MS = 300_000;
const splitSourceCompatPreload = "./tests/source-split-compat-preload.mjs";
const androidGeneratedInputs = {
  "22-body-frame-stage-9-8-pose-alignment.test.mjs": [
    "android/app/src/main/java/com/haebi/photoguide/pose/AndroidPoseAlignmentModule.kt"
  ],
  "android-aab-patch-policy.test.mjs": ["android/app/proguard-rules.pro"],
  "android-manifest-policy.test.mjs": [
    "android/app/src/main/AndroidManifest.xml",
    "android/app/src/debug/AndroidManifest.xml"
  ],
  "camera-color-adjustment-save.test.mjs": [
    "android/app/src/main/java/com/haebi/photoguide/MainApplication.kt",
    "android/app/src/main/java/com/haebi/photoguide/image/AndroidImageAdjustmentModule.kt"
  ]
};

const testFiles = fs
  .readdirSync(testsDirectory)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .filter((name) => {
    if (filters.length === 0 || defaultExcludedTests.has(name)) {
      return !defaultExcludedTests.has(name);
    }

    return filters.some((filter) => name.toLowerCase().includes(filter));
  });

if (filters.length === 0) {
  console.info("info - Firebase Rules emulator checks run via `npm run test:firebase-rules`.");
}

if (testFiles.length === 0) {
  console.error(
    filters.length > 0
      ? `No tests matched: ${filters.join(", ")}`
      : "No tests matched."
  );
  process.exit(1);
}

const missingAndroidInputs = testFiles.flatMap((fileName) =>
  (androidGeneratedInputs[fileName] ?? [])
    .filter((filePath) => !fs.existsSync(path.join(root, filePath)))
    .map((filePath) => `${fileName}: ${filePath}`)
);
if (missingAndroidInputs.length > 0) {
  console.error("Android generated inputs are missing; selected tests have not run:");
  console.error(missingAndroidInputs.join("\n"));
  console.error("Run `npx expo prebuild --platform android --no-install`, then rerun the tests.");
  process.exit(1);
}

for (const fileName of testFiles) {
  const filePath = path.join("tests", fileName);
  const result = spawnSync(
    process.execPath,
    ["--import", splitSourceCompatPreload, filePath],
    {
      cwd: root,
      stdio: "inherit",
      timeout: TEST_TIMEOUT_MS
    }
  );

  if (
    result.signal === "SIGTERM" ||
    (result.error && "code" in result.error && result.error.code === "ETIMEDOUT")
  ) {
    console.error(`${filePath} timed out after ${TEST_TIMEOUT_MS / 1000} seconds.`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
