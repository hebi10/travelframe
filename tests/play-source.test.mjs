import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/publish-play-release.mjs", import.meta.url));

test("release sources must be exact checked-out ancestors of the run's main commit", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-release-source-"));
  const git = (...arguments_) => {
    const result = spawnSync("git", ["-c", "user.name=ReleaseFixture", "-c", "user.email=release-fixture@example.invalid", ...arguments_], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const check = (sourceSha, mainSha) => spawnSync(process.execPath, [script, "check-source"], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_REPOSITORY: "hebi10/travelframe", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_SHA: mainSha, INPUT_SOURCE_SHA: sourceSha, INPUT_TRACK: "internal", INPUT_OPERATION: "publish", SOURCE_DIR: directory }
  });
  try {
    git("init", "--quiet", "--initial-branch=main");
    fs.writeFileSync(path.join(directory, "source.txt"), "reviewed\n");
    git("add", "source.txt");
    git("commit", "--quiet", "--no-gpg-sign", "-m", "reviewed source");
    const ancestor = git("rev-parse", "HEAD");
    fs.appendFileSync(path.join(directory, "source.txt"), "main update\n");
    git("commit", "--quiet", "--no-gpg-sign", "-am", "main update");
    const main = git("rev-parse", "HEAD");
    assert.equal(check(main, main).status, 0);
    git("checkout", "--quiet", ancestor);
    assert.equal(check(ancestor, main).status, 0);
    assert.notEqual(check(main, main).status, 0);
    git("checkout", "--quiet", "-b", "unreviewed", ancestor);
    fs.appendFileSync(path.join(directory, "source.txt"), "unreviewed change\n");
    git("commit", "--quiet", "--no-gpg-sign", "-am", "unreviewed source");
    const unreviewed = git("rev-parse", "HEAD");
    assert.notEqual(check(unreviewed, main).status, 0);
    assert.notEqual(check(unreviewed, "f".repeat(40)).status, 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
