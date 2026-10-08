import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeAudit, summarizeAudits } from "../scripts/summarize-npm-audit.mjs";

test("npm audit report lists vulnerable packages and nonbreaking available fixes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "body-audit-"));
  const report = path.join(dir, "example.json");
  try {
    fs.writeFileSync(report, JSON.stringify({
      vulnerabilities: {
        indirect: { severity: "high", isDirect: false, fixAvailable: false, via: [{ title: "example advisory" }] },
        direct: { severity: "moderate", isDirect: true, fixAvailable: { name: "direct", version: "1.2.3" }, via: [] }
      }
    }), "utf8");
    const items = normalizeAudit(report);
    assert.equal(items.length, 2);
    assert.equal(items[0].name, "indirect");
    assert.equal(items[0].severity, "high");
    assert.equal(items[1].fixAvailable, "direct@1.2.3");
    const summary = summarizeAudits([report]);
    assert.ok(summary.includes("2 affected packages"));
    assert.ok(summary.includes("example advisory"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed audit output fails instead of silently reporting zero vulnerabilities", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "body-audit-empty-"));
  const report = path.join(dir, "bad.json");
  try {
    fs.writeFileSync(report, "{}", "utf8");
    assert.throws(() => normalizeAudit(report), /Missing vulnerabilities report/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
