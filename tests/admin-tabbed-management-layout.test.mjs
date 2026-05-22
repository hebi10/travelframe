import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("admin/index.html", "utf8");
const js = fs.readFileSync("admin/admin.js", "utf8");
const css = fs.readFileSync("admin/styles.css", "utf8");

for (const snippet of [
  'id="leftAdminTabs"',
  'data-admin-tab="userSearch"',
  'data-admin-tab="operationLinks"',
  'id="userSearchPanel"',
  'id="operationLinksPanel"',
  'id="rightAdminTabs"',
  'data-admin-tab="userDetail"',
  'data-admin-tab="subscriptionManage"',
  'data-admin-tab="backupManage"',
  'id="userDetailPanel"',
  'id="subscriptionManagePanel"',
  'id="backupManagePanel"',
  'id="userSubscriptionSummary"',
  'id="resetWeeklyVideoExportButton"'
]) {
  assert.ok(html.includes(snippet), `admin tabbed layout HTML missing: ${snippet}`);
}

assert.ok(
  html.indexOf('id="searchForm"') < html.indexOf('id="userList"'),
  "left user tab should put direct search above user selection"
);

for (const snippet of [
  "const setAdminSectionTab =",
  "document.querySelectorAll(\"[data-admin-tab]\")",
  "const getCurrentVideoExportWeek =",
  "const resetWeeklyVideoExport = async () =>",
  "deleteDoc(doc(db, \"users\", currentUserDoc.id, \"usage\", \"videoExports\", \"weeks\", weekId))",
  'document.querySelectorAll("#leftAdminTabs [data-admin-tab]")',
  'document.querySelectorAll("#rightAdminTabs [data-admin-tab]")',
  '$("resetWeeklyVideoExportButton").addEventListener("click", resetWeeklyVideoExport);'
]) {
  assert.ok(js.includes(snippet), `admin tabbed layout JS missing: ${snippet}`);
}

for (const snippet of [
  ".admin-tabs",
  ".admin-tab-panel",
  ".admin-tab-panel.hidden"
]) {
  assert.ok(css.includes(snippet), `admin tabbed layout CSS missing: ${snippet}`);
}

console.log("ok - admin page splits management sections into tabs");
