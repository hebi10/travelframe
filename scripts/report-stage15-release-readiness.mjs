#!/usr/bin/env node
/**
 * Stage 15 release evidence inventory. Offline, read-only: no signing, uploads,
 * Firebase access, purchases, Google Play edits, or workflow approvals.
 *
 * "source_verified" only means the checked repository contracts are present.
 * External/physical checks always remain "requires_live_evidence".
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const json = (relativePath) => JSON.parse(read(relativePath));

export const REQUIRED_REGRESSION_TESTS = Object.freeze({
  "photo-identity-and-reorder": [
    "tests/body-frame-photo-identity-storage.test.mjs",
    "tests/body-frame-project-photo-import-reorder.test.mjs",
    "tests/body-frame-photo-comparison.test.mjs"
  ],
  "projects-measurements": [
    "tests/17-body-frame-stage-9-3-measurements.test.mjs",
    "tests/body-frame-design-stage14.test.mjs"
  ],
  "video-export-and-library": [
    "tests/body-frame-video-export-safety.test.mjs",
    "tests/video-library-persistent-storage.test.mjs",
    "tests/trip-clip-saved-video-edit-save.test.mjs"
  ],
  "backup-and-data-retention": [
    "tests/backup-target-selection.test.mjs",
    "tests/cloud-backup-delete-safety.test.mjs",
    "tests/backup-failure-retry.test.mjs"
  ],
  "billing-and-server-entitlements": [
    "tests/release-billing-replacement.test.mjs",
    "tests/backend-billing-token-regression.test.mjs",
    "tests/play-release-state.test.mjs"
  ],
  "ads-ump-and-consent": [
    "tests/release-consent-and-video.test.mjs",
    "tests/release-post-save-ad-lifecycle.test.mjs"
  ],
  "health-data-read-only": [
    "tests/21-body-frame-stage-9-7-health-connect.test.mjs"
  ],
  "privacy-release-signing": [
    "tests/legal-billing-disclosures.test.mjs",
    "tests/body-frame-stage9-play-preflight.test.mjs",
    "tests/play-auto-release-gate.test.mjs"
  ]
});

export const REQUIRED_LIVE_EVIDENCE = Object.freeze([
  ["android-arm64", "ARM64 physical-device camera, edit, album and native MP4 export/restore"],
  ["purchase-restore", "Google Play licensed test purchase, restore and six subscription replacements"],
  ["refund-rtdn", "Renewal, cancellation, expiry, refund/revocation and server RTDN delivery"],
  ["firebase-deployed", "Deployed production Functions/Firestore Rules and cloud backup/restore"],
  ["play-console-certificate", "Play Console upload-key certificate SHA-256 compared to the existing keystore pin"],
  ["play-products", "Active store products, real localized prices and test-track availability"],
  ["ad-consent", "AdMob app verification, app-ads.txt and UMP consent states on test devices"],
  ["health-declaration", "Public privacy/Data Safety/Health Connect declarations and permission rejection"],
  ["store-review", "Store listing screenshots, pre-launch report, current Play tracks and versionCode"],
  ["dependency-triage", "Current npm advisory report reviewed before any production approval"]
]);

export function collectStage15SourceEvidence() {
  const packageJson = json("package.json");
  const app = json("app.json").expo;
  const lock = json("package-lock.json");
  const workflows = {
    release: read(".github/workflows/android-play-aab.yml"),
    preflight: read(".github/workflows/body-frame-play-preflight.yml"),
    quality: read(".github/workflows/quality.yml")
  };
  const publish = read("scripts/publish-play-release.mjs");
  const checks = [
    ["identity", app.name === "바디 프레임" && app.android?.package === "com.haebi.photoguide"],
    ["version-alignment", app.version === packageJson.version && packageJson.version === lock.version &&
      packageJson.version === lock.packages?.[""]?.version],
    ["upload-window", publish.includes('export const EARLIEST_PLAY_PUBLISH_AT = "2026-11-07T02:01:00.000Z"') &&
      publish.includes('requirePlayPublishWindow(request.operation);') &&
      publish.includes('requirePlayPublishWindow("publish");')],
    ["approval-required", workflows.release.includes("vars.BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'") &&
      workflows.release.includes("github.ref == 'refs/heads/main'")],
    ["test-tracks-only", workflows.release.includes("options: [internal, closed]") &&
      !workflows.release.includes("refs/heads/production") &&
      publish.includes('["internal", "closed"].includes(logicalTrack)')],
    ["source-provenance", workflows.release.includes("scripts/publish-play-release.mjs check-source") &&
      workflows.release.includes("scripts/publish-play-release.mjs verify-artifact")],
    ["signing-preflight", workflows.preflight.includes("workflow_dispatch:") &&
      workflows.preflight.includes("scripts/check-play-upload-certificate.mjs") &&
      !workflows.preflight.includes("scripts/publish-play-release.mjs publish") &&
      !workflows.preflight.includes("bundleRelease")],
    ["node-test-suite", workflows.quality.includes("npm test") &&
      read("scripts/run-tests.mjs").includes(".endsWith(\".test.mjs\")")],
    ["release-source-check", workflows.quality.includes("npm run release:verify") &&
      packageJson.scripts?.["release:verify"] === "node scripts/verify-release-readiness.mjs"],
    ["health-read-only", app.android?.permissions?.includes("android.permission.health.READ_WEIGHT") &&
      app.android?.permissions?.includes("android.permission.health.READ_BODY_FAT") &&
      !app.android?.permissions?.some((p) => p.includes("WRITE_") && p.includes("health."))],
    ["privacy-documents", fs.existsSync(path.join(ROOT, "privacy/privacy-policy.md")) &&
      fs.existsSync(path.join(ROOT, "privacy/photo-guide-delete-account.html"))],
    ["manual-qa-matrix", read("docs/manual-device-qa.md").includes("Android 핵심 플로우") &&
      read("docs/release-ad-billing-qa.md").includes("내부 테스트 시나리오")]
  ].map(([id, passed]) => ({ id, status: passed ? "source_verified" : "source_failed" }));

  const suites = Object.entries(REQUIRED_REGRESSION_TESTS).map(([domain, filenames]) => ({
    domain,
    status: filenames.every((name) => fs.existsSync(path.join(ROOT, name)))
      ? "included_in_full_node_suite" : "missing_regression_test",
    files: filenames
  }));

  const manual = REQUIRED_LIVE_EVIDENCE.map(([id,proofRequired]) => ({
    id, status: "requires_live_evidence", proofRequired
  }));
  const hasFailedSource = checks.some((item) => item.status !== "source_verified") ||
    suites.some((item) => item.status !== "included_in_full_node_suite");

  return {
    schema: "body-frame-stage15-readiness-v1",
    package: app.android?.package,
    appVersion: app.version,
    sourceCommit: process.env.GITHUB_SHA || "local-unset",
    scope: "offline repository contracts only; no store signing/upload, billing or production Firebase operations",
    source: checks,
    regressionSuites: suites,
    manual,
    overallStatus: hasFailedSource ? "source_check_failed" : "awaiting_external_release_evidence",
    safeToPublish: false
  };
}

export function writeStage15Report(output = "stage15-release-readiness.json") {
  const report = collectStage15SourceEvidence();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", "utf8");
  const lines = [
    "# Body Frame Stage 15 — Source readiness (not a release approval)",
    "",
    "The report checks code and test registration only. No signed release or live purchase was tested.",
    "",
    "| Source check | Status |",
    "| --- | --- |",
    ...report.source.map((item) => "| " + item.id + " | " + item.status + " |"),
    "",
    "| Regression area | Status |",
    "| --- | --- |",
    ...report.regressionSuites.map((item) => "| " + item.domain + " | " + item.status + " |"),
    "",
    "## External evidence required before any publishing",
    ...report.manual.map((item) => "- [ ] " + item.id + ": " + item.proofRequired),
    "",
    "**Release authorization:** NOT GRANTED. The Play calendar/approval guard remains intact."
  ];
  fs.writeFileSync("stage15-release-readiness.md", lines.join("\n") + "\n", "utf8");
  if (report.overallStatus === "source_check_failed") {
    throw new Error("Stage15 offline source or regression coverage check failed");
  }
  console.log("Stage15 source checks passed; external live evidence pending. Nothing signed, uploaded or published.");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { writeStage15Report(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
