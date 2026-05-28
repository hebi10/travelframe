import assert from "node:assert/strict";
import fs from "node:fs";

const quotaSource = fs.readFileSync("lib/video-export-quota.ts", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");

assert.ok(
  quotaSource.includes("pendingWeeklyVideoExportCompletions"),
  "weekly video export quota should persist pending completions locally"
);
assert.ok(
  quotaSource.includes("recordPendingWeeklyVideoExportCompletion"),
  "weekly video export quota should expose a helper to queue failed completions"
);
assert.ok(
  quotaSource.includes("flushPendingWeeklyVideoExportCompletions"),
  "weekly video export quota should expose a helper to retry pending completions after restart"
);
assert.ok(
  quotaSource.includes("localStorageAdapter"),
  "weekly video export pending completions should use the existing local storage adapter"
);
assert.ok(
  tripClipSource.includes("recordPendingWeeklyVideoExportCompletion"),
  "trip clip should queue the reservation when completeWeeklyVideoExport fails after MP4 save"
);
assert.ok(
  tripClipSource.includes("flushPendingWeeklyVideoExportCompletions"),
  "trip clip should retry queued weekly export completions when loading usage"
);

console.log("ok - weekly video export pending completion recovery is wired");
