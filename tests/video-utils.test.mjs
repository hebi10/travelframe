import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const constantsSource = fs.readFileSync("constants/video.ts", "utf8");
const utilsSource = fs.readFileSync("lib/video-utils.ts", "utf8");
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
const rewrittenUtils = transpile(utilsSource).replace(
  /from "\@\/constants\/video"/g,
  `from "data:text/javascript,${encodeURIComponent(transpile(constantsSource))}"`
);
const utilsModule = await import(
  `data:text/javascript,${encodeURIComponent(rewrittenUtils)}`
);

assert.equal(constantsModule.MAX_VIDEO_DURATION_SECONDS, 180);
assert.equal(constantsModule.DEFAULT_VIDEO_QUALITY, "720p");
assert.deepEqual(
  constantsModule.VIDEO_QUALITY_OPTIONS.map((option) => [
    option.id,
    option.width,
    option.height,
    option.bitrate
  ]),
  [
    ["480p", 480, 854, 1200000],
    ["720p", 720, 1280, 3000000],
    ["1080p", 1080, 1920, 5000000]
  ]
);

assert.equal(
  utilsModule.calculateVideoDuration(["a", "b"], (id) => (id === "a" ? 2.5 : 4)),
  6.5
);
assert.equal(utilsModule.isVideoDurationTooLong(180), false);
assert.equal(utilsModule.isVideoDurationTooLong(180.1), true);
assert.equal(utilsModule.formatVideoDuration(179.6), "02:59");
assert.equal(utilsModule.formatVideoDuration(180), "03:00");
assert.equal(utilsModule.getVideoQualityOption("720p").label, "일반 화질 720p");
assert.deepEqual(utilsModule.getVideoQualityOutputSize("720p", 9 / 16), {
  width: 720,
  height: 1280
});
assert.deepEqual(utilsModule.getVideoQualityOutputSize("1080p", 9 / 16), {
  width: 1080,
  height: 1920
});

console.log("ok - video duration and quality utilities work");
