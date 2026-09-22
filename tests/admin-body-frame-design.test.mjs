import assert from "node:assert/strict";
import fs from "node:fs";

const adminHtml = fs.readFileSync("admin/index.html", "utf8");
const styles = fs.readFileSync("admin/styles.css", "utf8");
const adminJs = fs.readFileSync("admin/admin.js", "utf8");
const privacyHtml = fs.readFileSync("admin/privacy/index.html", "utf8");
const deleteHtml = fs.readFileSync(
  "admin/privacy/photo-guide-delete-account.html",
  "utf8"
);

assert.ok(
  adminHtml.includes('<body class="admin-page">'),
  "admin dashboard should opt into the Body Frame admin theme"
);
assert.ok(
  adminHtml.includes('class="brand-lockup"') &&
    adminHtml.includes('class="admin-logo"'),
  "admin header should use the Body Frame brand lockup"
);
assert.ok(
  adminHtml.includes("선택 사용자 플랜") &&
    adminHtml.includes("선택 사용자 백업") &&
    adminHtml.includes("활성 상품"),
  "dashboard KPI labels should describe selected-user context"
);

for (const token of [
  "--surface-soft: #0b0b0c",
  "--surface: #131315",
  "--surface-raised: #1a1a1d",
  "--ink: #f5f5f5",
  "--muted: #a0a0a6",
  "--line: #2a2a2e"
]) {
  assert.ok(styles.includes(token), `admin Body Frame token missing: ${token}`);
}

assert.ok(
  styles.includes(".admin-page .panel") &&
    styles.includes("box-shadow: none"),
  "admin cards should not use decorative shadows"
);
assert.ok(
  styles.includes(".admin-page .user-row.active::after"),
  "selected users should use a compact status indicator"
);
assert.ok(
  styles.includes(".admin-page .backup-item") &&
    styles.includes(".admin-page button.danger"),
  "backup rows and destructive actions should have explicit admin styling"
);
assert.ok(
  styles.includes("@media (max-width: 980px)") &&
    styles.includes("@media (max-width: 520px)"),
  "admin layout should include desktop-to-mobile responsive breakpoints"
);

assert.ok(
  adminJs.includes('button.setAttribute("aria-pressed", String(selected))'),
  "user selection should expose its selected state accessibly"
);
assert.ok(
  adminJs.includes('deleteButton.className = "danger"'),
  "backup delete action should carry an explicit danger state"
);
assert.ok(
  adminJs.includes("path.title = item.storagePath"),
  "truncated backup paths should keep the full path available"
);

assert.equal(
  privacyHtml.includes('class="admin-page"'),
  false,
  "privacy policy should keep the document theme rather than admin dark UI"
);
assert.equal(
  deleteHtml.includes('class="admin-page"'),
  false,
  "account deletion guide should keep the document theme rather than admin dark UI"
);

console.log("ok - Body Frame admin redesign stays scoped, responsive, and operational");
