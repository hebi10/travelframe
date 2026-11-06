import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

const preview = read("app/capture-preview.tsx");
assert.match(preview, /primaryButton:\s*\{[^}]*backgroundColor:\s*bodyFrameDarkColors\.text/);
assert.match(preview, /primaryButtonText:\s*\{[^}]*color:\s*bodyFrameDarkColors\.inverse/);
assert.doesNotMatch(preview, /bodyFrameAccent/);
assert.match(preview, /disabled=\{isSaving \|\| !previewUri\}/);
assert.match(preview, /onPress=\{usePhoto\}/);
assert.match(preview, /onPress=\{retakePhoto\}/);

const workflow = read(".github/workflows/body-frame-device-qa.yml");
assert.match(workflow, /stage13-design-captures:/);
assert.match(workflow, /fail-fast:\s*false/);
for (const size of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) {
  assert.ok(workflow.includes(size), size);
}
assert.ok(workflow.includes("capture-stage13-android.py"));
assert.ok(workflow.includes("Save every screenshot, gallery, UI XML and failure report"));
assert.ok(workflow.includes("retention-days: 90"));
const stage13Job = workflow.split("  stage13-design-captures:")[1]?.split("  stage6-design-matrix:")[0];
assert.ok(stage13Job && stage13Job.includes("target: google_apis"));
assert.ok(stage13Job.includes("fix/body-frame-stage13-"));
assert.ok(stage13Job.includes("swiftshader_indirect"));
assert.ok(!stage13Job.includes("target: google_atd"));


const capture = read("scripts/capture-stage13-android.py");
for (const label of [
  "project-metrics", "project-stats", "project-reminder", "compare",
  "photo-measurement", "video-photos", "video-interval",
  "video-quality", "video-ratio", "video-overlay",
  "empty-projects", "onboarding-welcome",
]) {
  assert.ok(capture.includes(label), label);
}
assert.ok(capture.includes("ro.kernel.qemu"));
assert.ok(capture.includes('"wifi", "disable"'));
assert.ok(capture.includes('"data", "disable"'));
assert.ok(capture.includes("gallery.html"));
assert.ok(capture.includes("screen-index.csv"));
assert.ok(capture.includes("capture-manifest.json"));
assert.ok(capture.includes("rgb_preview_is_reviewable"));
assert.ok(capture.includes("Unusable Android screenshot"));
assert.ok(capture.includes("verified_capture(device"));

console.log("Stage 13 screenshot matrix and monochrome preview CTA: PASS");
