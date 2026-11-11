import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";

const assets = [
  ["demo-01.jpg", "49d0f8d95510b9b0eeef517001f8c52e19c2b1600484d035ecc85e5352ff3bcb"],
  ["demo-02.jpg", "5cdf2cc2a8868c3d4794fbc29ddd49248a202aef9a3b05d61e7cc8124e2a923a"],
  ["demo-03.jpg", "933cb741e05caa1fe97f48e6395a8e7a1488a40af387a02e3a5965fac4e3446c"],
];

test("STORE-03-B assets match exact approved synthetic demo sources", () => {
  for (const [name, expected] of assets) {
    const data = fs.readFileSync("assets/store-demo/" + name);
    assert.ok(data.length > 20_000 && data.length < 500_000, name);
    assert.equal(data.subarray(0,2).toString("hex"), "ffd8", name);
    assert.equal(data.subarray(-2).toString("hex"), "ffd9", name);
    assert.equal(crypto.createHash("sha256").update(data).digest("hex"), expected, name);
  }
});

test("demo photo injection remains opt-in, offline, emulator-only", () => {
  const qa = fs.readFileSync("scripts/capture-android-qa.py", "utf8");
  const store = fs.readFileSync("scripts/capture-store-demo-android.py", "utf8");
  const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");
  assert.match(qa, /BODY_FRAME_STORE_DEMO_FIXTURES/);
  assert.match(store, /ro\.kernel\.qemu/);
  assert.match(store, /svc", "wifi", "disable/);
  assert.match(store, /svc", "data", "disable/);
  assert.match(workflow, /startsWith\(github\.head_ref, 'feat\/store-03b-demo-'/);
  assert.match(workflow, /BODY_FRAME_STORE_DEMO_FIXTURES: '1'/);
  assert.doesNotMatch(workflow, /\[publish-store-shots\]/);
});
