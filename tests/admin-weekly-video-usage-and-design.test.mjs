import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("admin/index.html", "utf8");
const js = fs.readFileSync("admin/admin.js", "utf8");
const css = fs.readFileSync("admin/styles.css", "utf8");

for (const removed of [
  'id="weeklyVideoUsageCard"',
  'id="weeklyVideoRemaining"',
  'id="weeklyVideoUsageDetail"',
  'id="weeklyVideoUsageMeta"',
  'id="weeklyVideoUsageFill"',
  'id="resetWeeklyVideoExportButton"'
]) {
  assert.equal(
    html.includes(removed),
    false,
    `registered-user admin should not show obsolete weekly export quota UI: ${removed}`
  );
}

for (const token of [
  "광고 제거 · 1회성",
  "Pro · 1개월 구독",
  "Plus · 1개월 구독",
  "Expert · 1개월 구독",
  'id="productStartInput"',
  'id="subscriptionDurationSelect"',
  '<option value="1">1개월</option>',
  '<option value="12">12개월</option>',
  '<option value="custom">직접 지정</option>',
  'id="productExpiresInput"',
  "로그인 사용자는 제한 없음",
  "const syncSubscriptionExpiry = () =>",
  "addCalendarMonths",
  "termMonths"
]) {
  assert.ok(js.includes(token), `admin subscription editor missing: ${token}`);
}

for (const removed of [
  "const weeklyVideoExportLimits =",
  "const getWeeklyVideoExportLimitForCurrentUser =",
  "const resetWeeklyVideoExport = async () =>"
]) {
  assert.equal(
    js.includes(removed),
    false,
    `admin should not keep registered-user weekly quota code: ${removed}`
  );
}

for (const token of [
  ".subscription-editor-layout",
  ".subscription-policy-panel",
  ".subscription-form-footer",
  ".policy-list",
  "label.is-disabled"
]) {
  assert.ok(css.includes(token), `admin subscription design CSS missing: ${token}`);
}

console.log("ok - admin subscription UI models one-time ad removal and configurable monthly terms");
