import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";

const spec = JSON.parse(fs.readFileSync("docs/release-assets/brand-icon-20261111.json", "utf8"));
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test("TravelFrame flat brand assets are exactly the reviewed PNGs", () => {
  assert.equal(spec.packageName, "com.haebi.photoguide");
  assert.equal(spec.locale, "ko-KR");
  assert.equal(spec.googlePlayPublished, false);
  for (const asset of spec.assets) {
    const bytes = fs.readFileSync(asset.path);
    assert.equal(bytes.length, asset.bytes, asset.path);
    assert.ok(bytes.subarray(0, 8).equals(signature), asset.path);
    assert.equal(bytes.readUInt32BE(16), asset.width, asset.path);
    assert.equal(bytes.readUInt32BE(20), asset.height, asset.path);
    assert.equal(bytes[24], asset.pngBitDepth, asset.path);
    assert.equal(bytes[25], asset.pngColorType, asset.path);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.path);
  }
});

test("Android launcher, adaptive and splash point at the approved monochrome identity", () => {
  const app = JSON.parse(fs.readFileSync("app.json", "utf8")).expo;
  assert.equal(app.icon, "./assets/icons/app-icon.png");
  assert.equal(app.android.adaptiveIcon.foregroundImage, "./assets/icons/adaptive-icon.png");
  assert.equal(app.android.adaptiveIcon.backgroundColor, "#151719");
  assert.equal(app.splash.image, "./assets/icons/splash-icon.png");
  assert.equal(app.android.splash.image, "./assets/icons/splash-icon.png");
  assert.equal(spec.assets[0].sha256, spec.assets[1].sha256);
  const icon = spec.assets.find(a => a.role === "play-listing-icon");
  assert.equal(icon.width, 512);
  assert.equal(icon.height, 512);
  assert.equal(icon.pngColorType, 6);
});
