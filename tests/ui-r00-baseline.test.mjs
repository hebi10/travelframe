import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("scripts/capture_ui_r00_baseline.py", "utf8");
const data = fs.readFileSync("scripts/ui_r00_data_fixtures.py", "utf8");
const verify = fs.readFileSync("scripts/verify_ui_r00_baseline.py", "utf8");
const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");

test("UI-R00 captures Android pages rather than generated UI", () => {
  assert.match(source, /stage13\.verified_capture/);
  assert.match(source, /camera-reference-adjust/);
  for (const screen of ["compare", "measurements", "video-home", "video-create", "account"]) {
    assert.ok(source.includes('"' + screen + '"'), screen);
  }
  assert.match(source, /ro\.kernel\.qemu/);
  assert.match(source, /BODY_FRAME_STORE_DEMO_FIXTURES/);
  assert.match(source, /svc", "wifi", "disable/);
  assert.match(source, /svc", "data", "disable/);
});

test("UI-R00 includes empty, one, many and three projects without live data", () => {
  for (const sample of ["no-project", "project-no-photo", "project-one-photo", "project-many-photos", "three-projects", "first-run", "video-empty", "guest"]) {
    assert.ok(data.includes('"' + sample + '"'), sample);
  }
  assert.match(data, /qa\.fixture_values/);
  assert.match(data, /qa-r00-project/);
  assert.match(verify, /sha256/);
  assert.match(verify, /pixelEvidenceValid/);
  assert.match(verify, /len\(app_hashes\) != 1/);
});

test("UI-R00 workflow isolates source and never deploys to Google Play", () => {
  assert.match(workflow, /qa\/ui-r00-/);
  assert.match(workflow, /ui-r00-captures/);
  assert.match(workflow, /ui-r00-verify/);
  assert.match(workflow, /UI-R00 integrated 100-image verification/);
  assert.match(workflow, /git diff --name-only "\$UI_R00_BASE_SHA" HEAD/);
  assert.match(workflow, /name: travelframe-ui-r00-final-verification-/);
  assert.doesNotMatch(source, /Google Play API|upload[Aa]b[Bb]|publish[A-Z]/);
});
