import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("admin/index.html", "utf8");
const js = fs.readFileSync("admin/admin.js", "utf8");
const css = fs.readFileSync("admin/styles.css", "utf8");

for (const snippet of [
  'id="weeklyVideoUsageCard"',
  'id="weeklyVideoRemaining"',
  'id="weeklyVideoUsageDetail"',
  'id="weeklyVideoUsageMeta"',
  'id="weeklyVideoUsageFill"',
  'class="usage-strip"',
  'class="usage-meter"'
]) {
  assert.ok(html.includes(snippet), `weekly video usage UI missing in HTML: ${snippet}`);
}

for (const snippet of [
  "const weeklyVideoExportLimits =",
  "free: 1",
  "ad_remove: 1",
  "pro: 15",
  "expert: 30",
  "const getAdminPlanTier = () =>",
  "const getWeeklyVideoExportLimitForCurrentUser = () =>",
  "...current,\n      productId",
  "const renderWeeklyVideoExportUsage = async () =>",
  'doc(db, "users", currentUserDoc.id, "usage", "videoExports", "weeks", weekId)',
  '$("weeklyVideoRemaining").textContent',
  '$("weeklyVideoUsageDetail").textContent',
  '$("weeklyVideoUsageMeta").textContent',
  '$("weeklyVideoUsageFill").style.width',
  "await renderWeeklyVideoExportUsage();"
]) {
  assert.ok(js.includes(snippet), `weekly video usage JS missing: ${snippet}`);
}

for (const snippet of [
  "--surface-soft",
  ".panel-header",
  ".usage-strip",
  ".usage-meter",
  ".form-grid",
  ".form-actions",
  "border-radius: 8px",
  "box-shadow:"
]) {
  assert.ok(css.includes(snippet), `admin refreshed design CSS missing: ${snippet}`);
}

console.log("ok - admin subscription tab shows weekly usage and refreshed layout");
