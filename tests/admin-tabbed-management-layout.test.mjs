import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("admin/index.html", "utf8");
const js = fs.readFileSync("admin/admin.js", "utf8");
const css = fs.readFileSync("admin/styles.css", "utf8");

for (const snippet of [
  'class="admin-console"',
  'class="user-sidebar panel strong"',
  'id="selectedUserHeader"',
  'id="rightAdminTabs"',
  'data-admin-tab="userDetail"',
  'data-admin-tab="subscriptionManage"',
  'data-admin-tab="backupManage"',
  'id="userDetailPanel"',
  'id="subscriptionManagePanel"',
  'id="backupManagePanel"',
  'id="userSubscriptionSummary"'
]) {
  assert.ok(html.includes(snippet), `admin console HTML missing: ${snippet}`);
}

assert.ok(
  html.indexOf('id="searchForm"') < html.indexOf('id="userList"'),
  "user sidebar should put its single search above the user list"
);

for (const removed of [
  'id="leftAdminTabs"',
  'data-admin-tab="operationLinks"',
  'id="operationLinksPanel"',
  'id="userFilterInput"',
  'id="resetWeeklyVideoExportButton"'
]) {
  assert.equal(
    html.includes(removed),
    false,
    `admin console should not expose legacy duplicate controls: ${removed}`
  );
}

for (const snippet of [
  "const setAdminSectionTab =",
  'document.querySelectorAll("#rightAdminTabs [data-admin-tab]")',
  '$("searchInput").addEventListener("input"',
  "const syncSubscriptionExpiry = () =>",
  '$("subscriptionDurationSelect").addEventListener("change", syncSubscriptionExpiry)',
  '$("productStartInput").addEventListener("change", syncSubscriptionExpiry)'
]) {
  assert.ok(js.includes(snippet), `admin console JS missing: ${snippet}`);
}

for (const snippet of [
  ".admin-console",
  ".user-sidebar",
  ".selected-user-header",
  ".admin-tab-panel.hidden",
  ".subscription-editor-layout"
]) {
  assert.ok(css.includes(snippet), `admin console CSS missing: ${snippet}`);
}

console.log("ok - admin page uses a user sidebar and selected-user console");
