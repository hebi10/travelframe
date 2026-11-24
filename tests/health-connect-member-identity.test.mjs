import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("lib/body-health-connect-import.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
});
const { groupBodyHealthConnectMeasurements, resolveHealthConnectMeasurementMatch, getHealthConnectSourceMemberIds, getHealthConnectReservedEntryIds } = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);
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

const sameTimeFat = { ...fat, recordedAt: timestamp };
const legacyPair = {
  id: "legacy-pair", projectId: "project", source: "health_connect",
  sourceRecordId: groupBodyHealthConnectMeasurements([first, sameTimeFat])[0].sourceRecordId,
  sourceAppPackage: "scale", recordedAt: timestamp, weightKg: 70, bodyFatPercent: 19, photoId: "old-photo"
};
for (const candidate of [first, sameTimeFat]) {
  const [group] = groupBodyHealthConnectMeasurements([candidate], [legacyPair]);
  const { existing } = resolveHealthConnectMeasurementMatch(group, [legacyPair], new Set());
  assert.equal(existing.id, legacyPair.id);
  assert.deepEqual(getHealthConnectSourceMemberIds(existing, group), [], "single-metric import must retain the legacy alias");
}
const [legacyCombined] = groupBodyHealthConnectMeasurements([first, sameTimeFat], [legacyPair]);
assert.equal(legacyCombined.originalRecordIds.length, 2);
assert.equal(resolveHealthConnectMeasurementMatch(legacyCombined, [legacyPair], new Set()).existing.id, legacyPair.id);
const migrated = { ...legacyPair, sourceMemberIds: getHealthConnectSourceMemberIds(legacyPair, legacyCombined) };
assert.deepEqual(migrated.sourceMemberIds, ["member-A", "member-fat"]);
for (const candidate of [first, sameTimeFat]) {
  const [group] = groupBodyHealthConnectMeasurements([candidate], [migrated]);
  assert.equal(resolveHealthConnectMeasurementMatch(group, [migrated], new Set()).existing.id, legacyPair.id);
}
const partialLegacy = { ...legacyPair, sourceMemberIds: ["member-A"] };
const [repaired] = groupBodyHealthConnectMeasurements([first, sameTimeFat], [partialLegacy]);
assert.equal(repaired.originalRecordIds.length, 2);
assert.deepEqual(getHealthConnectSourceMemberIds(partialLegacy, repaired), ["member-A", "member-fat"]);
const separateLegacy = [
  { ...legacyPair, id: "legacy-weight", bodyFatPercent: undefined, photoId: undefined },
  { ...legacyPair, id: "legacy-fat", sourceRecordId: groupBodyHealthConnectMeasurements([fat])[0].sourceRecordId,
    weightKg: undefined, recordedAt: fat.recordedAt, photoId: undefined }
];
assert.equal(groupBodyHealthConnectMeasurements([first, fat], separateLegacy).length, 2,
  "pre-upgrade independently saved entries must not merge");
console.log("ok - legacy metric toggles preserve group identity until member migration is complete");

for (const order of [[second, first, sameTimeFat], [first, sameTimeFat, second], [sameTimeFat, second, first]]) {
  const imported = groupBodyHealthConnectMeasurements(order, [legacyPair]);
  assert.equal(imported.length, 2);
  const reserved = getHealthConnectReservedEntryIds(imported);
  assert.ok(reserved.has(legacyPair.id));
  const matched = new Set();
  for (const group of imported) {
    const { existing, legacy } = resolveHealthConnectMeasurementMatch(group, [legacyPair], matched, reserved);
    if (group.originalRecordIds.includes("member-B")) {
      assert.equal(existing, undefined, "new same-time weight must not consume a reserved legacy pair");
      assert.equal(legacy.length, 0, "reserved legacy record must also be protected from duplicate cleanup");
    } else {
      assert.equal(existing?.id, legacyPair.id);
      assert.deepEqual(getHealthConnectSourceMemberIds(existing, group).sort(), ["member-A", "member-fat"]);
    }
    if (existing) matched.add(existing.id);
  }
  assert.equal(matched.size, 1);
}
console.log("ok - inferred legacy owners are reserved across all groups before timestamp fallback");
