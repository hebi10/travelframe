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

for (const label of ["전체 사용자", "활성 구독", "백업 사용자"]) {
  assert.ok(
    adminHtml.includes(label),
    `global admin KPI should contain ${label}`
  );
}
for (const oldLabel of ["선택 사용자 플랜", "선택 사용자 백업", "활성 상품"]) {
  assert.equal(
    adminHtml.includes(oldLabel),
    false,
    `global KPI row should not mix selected-user data: ${oldLabel}`
  );
}

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

for (const token of [
  "width: min(1440px, calc(100% - 40px));",
  ".admin-page .admin-console",
  "grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);",
  ".admin-page input:-webkit-autofill",
  "border-radius: 4px;",
  ".admin-page .subscription-summary",
  "grid-template-columns: repeat(4, minmax(0, 1fr));"
]) {
  assert.ok(styles.includes(token), `admin console design missing: ${token}`);
}

assert.ok(
  styles.includes(".admin-page .panel") &&
    styles.includes("box-shadow: none"),
  "admin cards should not use decorative shadows"
);
assert.ok(
  styles.includes("@media (max-width: 820px)") &&
    styles.includes("@media (max-width: 520px)"),
  "admin layout should remain responsive"
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
  adminJs.includes('document.querySelector(".ops-menu")?.classList.toggle("hidden", !enabled)'),
  "operation links should only appear after administrator authentication"
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

console.log("ok - Body Frame admin uses the user-console design system");
