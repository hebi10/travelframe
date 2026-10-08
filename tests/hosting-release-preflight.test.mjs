import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyHostingReleaseSource } from "../scripts/verify-hosting-release.mjs";

test("hosting source points to expected project and correctly publishes privacy and ad files", () => {
  const result = verifyHostingReleaseSource();
  assert.equal(result.project, "travelframe-4e1fb");
  assert.equal(result.publicDirectory, "admin");
});

test("hosting preflight rejects an unintended Firebase project", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hosting-preflight-"));
  try {
    fs.mkdirSync(path.join(dir, "admin/privacy"), { recursive: true });
    for (const file of ["firebase.json", ".firebaserc", "app.json", "admin/app-ads.txt",
      "admin/privacy/index.html", "admin/privacy/photo-guide-delete-account.html"]) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.copyFileSync(file, path.join(dir, file));
    }
    fs.writeFileSync(path.join(dir, ".firebaserc"), '{"projects":{"default":"a-different-project"}}');
    assert.throws(() => verifyHostingReleaseSource(dir), /Wrong Firebase project/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
