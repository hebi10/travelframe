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
  .replace(/^import .* from "firebase\/functions";\n/m, "")
  .replace(/^import .* from "@\/lib\/firebase";\n/m, "")
  .replace(
    /^import \{ localStorageAdapter \} from "@\/lib\/local-storage";\n/m,
    "const localStorageAdapter = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };\n"
  );

const {
  FREE_WEEKLY_VIDEO_EXPORT_LIMIT,
  PRO_WEEKLY_VIDEO_EXPORT_LIMIT,
  EXPERT_WEEKLY_VIDEO_EXPORT_LIMIT,
  buildWeeklyVideoExportUsage,
  canReserveWeeklyVideoExport,
  completeWeeklyVideoExport,
  reserveWeeklyVideoExport,
  releaseWeeklyVideoExport
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

assert.ok(
  source.includes('httpsCallable(firebaseFunctions, "reserveWeeklyVideoExport")'),
  "weekly video export reservations should use the server callable"
);
assert.ok(
  source.includes('httpsCallable(firebaseFunctions, "releaseWeeklyVideoExport")'),
  "weekly video export releases should use the server callable"
);
assert.ok(
  source.includes('httpsCallable(firebaseFunctions, "completeWeeklyVideoExport")'),
  "weekly video export completion should use the server callable"
);
assert.ok(
  source.includes("reservationId"),
  "weekly video export reservations should carry a reservationId"
);
assert.ok(
  source.includes("buildWeeklyVideoExportReservation"),
  "weekly video export callable responses should be normalized before use"
);
assert.equal(
  source.includes("runTransaction"),
  false,
  "weekly video export quota should not be reserved by direct client Firestore transactions"
);
assert.equal(
  source.includes("setDoc"),
  false,
  "weekly video export quota should not be released by direct client Firestore writes"
);
assert.equal(typeof reserveWeeklyVideoExport, "function");
assert.equal(typeof releaseWeeklyVideoExport, "function");
assert.equal(typeof completeWeeklyVideoExport, "function");

console.log("ok - weekly video export quota supports free, pro, and expert limits");
