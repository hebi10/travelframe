import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => fs.readFileSync(path, "utf8");
const navigation = read("lib/plan-navigation.ts");
const routes = [
  ["features/camera/BodyFrameCameraScreen.tsx", 'openPlans("camera"'],
  ["features/records/BodyFrameRecordsScreen.tsx", 'openPlans("records"'],
  ["features/records/BodyFrameProjectDetailScreen.tsx", 'openPlans("project"'],
  ["features/trip-clip/BodyFrameVideoScreen.tsx", 'openPlans("video"'],
  ["features/trip-clip/BodyFrameVideoHomeScreen.tsx", 'openPlans("video"'],
  ["features/settings/BodyFrameSettingsScreen.tsx", 'openPlans("backup"'],
  ["features/account/CloudBackupProjectSlotsSection.tsx", 'openPlans("backup"']
];

test("TF-PAY-UX-03: contextual entry points use one dedicated plan route", () => {
  assert.match(navigation, /pathname: "\/plans"/);
  assert.match(navigation, /recommendation\.toLowerCase\(\)/);
  for (const [file, text] of routes) {
    const source = read(file);
    assert.ok(source.includes(text), file + " must display its contextual plan route");
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, "invalid TSX: " + file);
  }
});

test("TF-PAY-UX-03: contextual hints and free-plan backup entry use existing access limits", () => {
  const plans = read("features/account/PlanScreen.tsx");
  assert.ok(plans.includes("entryMessages"));
  assert.ok(plans.includes("suggestedPlan === tier"));
  assert.ok(plans.includes("source?: string"));
  assert.ok(plans.includes("useLocalSearchParams"));
  assert.ok(read("features/account/CloudBackupProjectSlotsSection.tsx").includes("maxSlots <= 0"));
  assert.ok(read("features/trip-clip/BodyFrameVideoHomeScreen.tsx").includes("planEntitlements.showWatermark"));
});
