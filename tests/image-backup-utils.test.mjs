import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const constantsSource = fs.readFileSync("constants/image.ts", "utf8");
const utilsSource = fs.readFileSync("lib/image-backup-utils.ts", "utf8");
const transpile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;

const constantsModule = await import(
  `data:text/javascript,${encodeURIComponent(transpile(constantsSource))}`
);
const utilityOnlySource = utilsSource
  .replace(/import \* as FileSystem from "expo-file-system\/legacy";\n/, "")
  .replace(/import \{ manipulateAsync, SaveFormat \} from "expo-image-manipulator";\n/, "")
  .replace(/import \{ Image \} from "react-native";\n/, "")
  .replace(/export const optimizeImageForBackup[\s\S]*?;\n\nexport const calculateCombinedImageBackupSize/, "export const calculateCombinedImageBackupSize");
const rewrittenUtils = transpile(utilityOnlySource).replace(
  /from "\@\/constants\/image"/g,
  `from "data:text/javascript,${encodeURIComponent(transpile(constantsSource))}"`
);
const utilsModule = await import(
  `data:text/javascript,${encodeURIComponent(rewrittenUtils)}`
);

assert.equal(constantsModule.MAX_TOTAL_IMAGE_BACKUP_SIZE_BYTES, 1024 * 1024 * 1024);
assert.equal(constantsModule.DEFAULT_IMAGE_QUALITY, "normal");
assert.deepEqual(
  constantsModule.IMAGE_QUALITY_OPTIONS.map((option) => [
    option.value,
    option.label,
    option.maxLongSide,
    option.quality
  ]),
  [
    ["low", "저용량", 1280, 0.78],
    ["normal", "일반 화질", 1920, 0.88],
    ["high", "고화질", 2560, 0.94]
  ]
);
assert.equal(utilsModule.getImageQualityOption("high").quality, 0.94);
assert.equal(utilsModule.getImageQualityOption("unknown").quality, 0.88);
assert.equal(utilsModule.calculateCombinedImageBackupSize(100, [20, 30]), 150);
assert.equal(utilsModule.isImageBackupSizeExceeded(1024 * 1024 * 1024), false);
assert.equal(utilsModule.isImageBackupSizeExceeded(1024 * 1024 * 1024 + 1), true);
assert.equal(utilsModule.formatImageBackupSize(384 * 1024 * 1024), "384MB");
assert.equal(utilsModule.formatImageBackupUsage(384 * 1024 * 1024), "서버 백업 용량 384MB / 2GB");
assert.deepEqual(
  utilsModule.getImageResizeAction({ width: 4000, height: 2000, maxLongSide: 1920 }),
  { resize: { width: 1920, height: 960 } }
);
assert.equal(
  utilsModule.getImageResizeAction({ width: 1200, height: 800, maxLongSide: 1920 }),
  undefined
);

const optimizePrelude = `
const calls = [];
const fileSizes = new Map([
  ["file://large.jpg", 8000000],
  ["file://optimized.jpg", 900000]
]);
const FileSystem = {
  getInfoAsync: async (uri) => ({ exists: true, size: fileSizes.get(uri) ?? 1 })
};
const SaveFormat = { JPEG: "jpeg" };
const manipulateAsync = async (uri, actions, options) => {
  calls.push({ uri, actions, options });
  return { uri: "file://optimized.jpg", width: 1920, height: 1080 };
};
const Image = {
  getSize: (uri, onSuccess) => onSuccess(4000, 2250)
};
export const __imageOptimizationTest = { calls };
`;
const optimizableUtilsSource = utilsSource
  .replace(/import \* as FileSystem from "expo-file-system\/legacy";\n/, "")
  .replace(/import \{ manipulateAsync, SaveFormat \} from "expo-image-manipulator";\n/, "")
  .replace(/import \{ Image \} from "react-native";\n/, "");
const rewrittenOptimizableUtils = transpile(`${optimizePrelude}\n${optimizableUtilsSource}`).replace(
  /from "\@\/constants\/image"/g,
  `from "data:text/javascript,${encodeURIComponent(transpile(constantsSource))}"`
);
const optimizableUtilsModule = await import(
  `data:text/javascript,${encodeURIComponent(rewrittenOptimizableUtils)}`
);

const optimized = await optimizableUtilsModule.optimizeImageForBackup({
  uri: "file://large.jpg",
  imageQuality: "normal"
});
assert.equal(optimized.width, 1920);
assert.equal(optimized.height, 1080);
assert.deepEqual(
  optimizableUtilsModule.__imageOptimizationTest.calls[0].actions,
  [{ resize: { width: 1920, height: 1080 } }]
);

const reused = await optimizableUtilsModule.optimizeImageForBackup({
  uri: "file://large.jpg",
  width: 1920,
  height: 1080,
  imageQuality: "normal",
  sourceImageQuality: "normal"
});
assert.equal(reused.uri, "file://large.jpg");
assert.equal(reused.width, 1920);
assert.equal(reused.height, 1080);
assert.equal(reused.size, 8000000);
assert.equal(reused.originalSize, 8000000);
assert.equal(
  optimizableUtilsModule.__imageOptimizationTest.calls.length,
  1,
  "already optimized images should not be recompressed for backup retry"
);

console.log("ok - image backup constants and utilities work");
