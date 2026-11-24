import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("lib/body-health-connect-import.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
});
const { groupBodyHealthConnectMeasurements, resolveHealthConnectMeasurementMatch } = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);
const timestamp = "2026-11-20T21:00:00.000Z";
const first = { metric: "weight", value: 70, recordedAt: timestamp, sourceRecordId: "member-A", sourceAppPackage: "scale" };
const second = { ...first, value: 73, sourceRecordId: "member-B" };
const groups = groupBodyHealthConnectMeasurements([first, second]);
assert.equal(groups.length, 2);
const saved = groups.map((group, index) => ({
  id: "saved-" + index, source: "health_connect",
  sourceRecordId: group.sourceRecordId, sourceMemberIds: group.originalRecordIds,
  weightKg: group.weightKg, photoId: index === 0 ? "other-photo" : undefined
}));
const [later] = groupBodyHealthConnectMeasurements([second], saved);
assert.equal(later.sourceRecordId, saved[0].sourceRecordId);
assert.equal(resolveHealthConnectMeasurementMatch(later, saved, new Set()).existing.id, saved[1].id);
assert.equal(resolveHealthConnectMeasurementMatch(later, [saved[0]], new Set()).existing, undefined);
assert.equal(resolveHealthConnectMeasurementMatch(later, saved, new Set([saved[1].id])).existing, undefined);
const legacy = { id: "legacy", source: "health_connect", sourceRecordId: later.sourceRecordId };
assert.equal(resolveHealthConnectMeasurementMatch(later, [legacy], new Set()).existing.id, "legacy");
assert.equal(resolveHealthConnectMeasurementMatch(later, [...saved, legacy], new Set()).existing.id, saved[1].id);
const fat = { ...first, metric: "bodyFat", value: 19, sourceRecordId: "member-fat", recordedAt: "2026-11-20T21:00:30.000Z" };
const separate = [first, fat].map((candidate, index) => {
  const [group] = groupBodyHealthConnectMeasurements([candidate]);
  return { id: "separate-" + index, source: "health_connect", sourceRecordId: group.sourceRecordId, sourceMemberIds: group.originalRecordIds };
});
const reimported = groupBodyHealthConnectMeasurements([first, fat], separate);
assert.equal(reimported.length, 2, "independently saved single metrics must not merge into duplicates");
for (const group of reimported) {
  const expected = separate.find(entry => entry.sourceMemberIds.includes(group.originalRecordIds[0]));
  assert.equal(resolveHealthConnectMeasurementMatch(group, separate, new Set()).existing.id, expected.id);
}
assert.equal(groupBodyHealthConnectMeasurements([first, fat]).length, 1, "new complementary metrics still pair");
console.log("ok - persisted Health Connect member identities take precedence over colliding generated IDs and preserve independently saved records");
