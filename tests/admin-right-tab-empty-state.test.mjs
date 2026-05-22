import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("admin/index.html", "utf8");
const js = fs.readFileSync("admin/admin.js", "utf8");
const css = fs.readFileSync("admin/styles.css", "utf8");

for (const snippet of [
  'id="userEmptyPanel"',
  'id="subscriptionEmptyPanel"',
  'id="backupEmptyPanel"',
  "사용자를 선택해 주세요",
  "구독을 관리할 사용자를 선택해 주세요",
  "백업을 관리할 사용자를 선택해 주세요"
]) {
  assert.ok(html.includes(snippet), `admin right tab empty state missing: ${snippet}`);
}

assert.ok(
  html.indexOf('id="userEmptyPanel"') < html.indexOf('id="userPanel"'),
  "user detail tab should show a selected-user empty state before the hidden detail panel"
);

for (const snippet of [
  "const setSelectedUserPanelsVisible = (hasSelectedUser) => {",
  '$(\"userEmptyPanel\")?.classList.toggle(\"hidden\", hasSelectedUser);',
  '$(\"subscriptionEmptyPanel\")?.classList.toggle(\"hidden\", hasSelectedUser);',
  '$(\"backupEmptyPanel\")?.classList.toggle(\"hidden\", hasSelectedUser);',
  'userPanel.classList.toggle(\"hidden\", !hasSelectedUser);',
  'subscriptionPanel.classList.toggle(\"hidden\", !hasSelectedUser);',
  'backupPanel.classList.toggle(\"hidden\", !hasSelectedUser);',
  "setSelectedUserPanelsVisible(false);",
  "setSelectedUserPanelsVisible(true);"
]) {
  assert.ok(js.includes(snippet), `admin right tab selected state toggle missing: ${snippet}`);
}

for (const snippet of [
  "align-content: start;",
  ".empty-state",
  "min-height: 132px"
]) {
  assert.ok(css.includes(snippet), `admin right tab layout CSS missing: ${snippet}`);
}

console.log("ok - admin right tabs show tidy empty states and fixed-height tab rows");
