import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/android-play-aab.yml", "utf8");
assert.ok(workflow.includes("push:\n    branches: [main]"), "main push workflow must remain configured");
const start = workflow.indexOf("\n  plan:");
const end = workflow.indexOf("\n  build:", start);
assert.ok(start > 0 && end > start);
const plan = workflow.slice(start, end);
const condition = "if: github.repository == 'hebi10/travelframe' && github.ref == 'refs/heads/main' && (inputs.operation == 'inventory' || vars.BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true')";
assert.ok(plan.includes(condition), "Release plan must not run on pushes or publish without explicit verified signing approval");
const keyCheck = plan.indexOf("run: node build-tools/scripts/check-play-upload-certificate.mjs");
const publishOnlyKeyCheck = /name: Verify the upload keystore before contacting Play\n\s+if: steps\.resolve\.outputs\.operation == 'publish'/;
assert.match(plan, publishOnlyKeyCheck, "Read-only inventory must run without signing credentials");
assert.ok(keyCheck > plan.indexOf("id: resolve") && keyCheck < plan.indexOf("id: auth"), "Verify the upload key after the calendar gate and before Play authentication");
assert.ok(workflow.includes("needs: plan"), "Build must depend on held release plan");
assert.ok(workflow.includes("needs: [plan, build]"), "Publish must depend on held plan and signed build");
assert.ok(workflow.includes("workflow_dispatch:"), "Manual inventory must remain available");
console.log("ok - Play AAB main-push release held until verified signing gate");
