import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/video-export-quota.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText
  .replace(/^import .* from "firebase\/firestore";\n/m, "")
  .replace(/^import .* from "@\/lib\/firebase";\n/m, "");

const {
  FREE_WEEKLY_VIDEO_EXPORT_LIMIT,
  PRO_WEEKLY_VIDEO_EXPORT_LIMIT,
  EXPERT_WEEKLY_VIDEO_EXPORT_LIMIT,
  buildWeeklyVideoExportUsage,
  canReserveWeeklyVideoExport
} = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

assert.equal(FREE_WEEKLY_VIDEO_EXPORT_LIMIT, 1);
assert.equal(PRO_WEEKLY_VIDEO_EXPORT_LIMIT, 15);
assert.equal(EXPERT_WEEKLY_VIDEO_EXPORT_LIMIT, 30);

assert.deepEqual(
  buildWeeklyVideoExportUsage({
    weekId: "2026-05-18",
    weekLabel: "5월 18일 - 5월 24일",
    count: 0,
    limit: 1
  }),
  {
    weekId: "2026-05-18",
    weekLabel: "5월 18일 - 5월 24일",
    count: 0,
    limit: 1,
    remaining: 1
  }
);

assert.deepEqual(
  buildWeeklyVideoExportUsage({
    weekId: "2026-05-18",
    weekLabel: "5월 18일 - 5월 24일",
    count: 14,
    limit: 15
  }),
  {
    weekId: "2026-05-18",
    weekLabel: "5월 18일 - 5월 24일",
    count: 14,
    limit: 15,
    remaining: 1
  }
);

assert.equal(canReserveWeeklyVideoExport({ count: 0, limit: 1 }), true);
assert.equal(canReserveWeeklyVideoExport({ count: 1, limit: 1 }), false);
assert.equal(canReserveWeeklyVideoExport({ count: 14, limit: 15 }), true);
assert.equal(canReserveWeeklyVideoExport({ count: 15, limit: 15 }), false);
assert.equal(canReserveWeeklyVideoExport({ count: 0, limit: 0 }), false);

console.log("ok - weekly video export quota supports free, pro, and expert limits");
