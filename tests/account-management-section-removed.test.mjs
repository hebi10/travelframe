import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountSource = readFileSync("features/account/AccountScreen.tsx", "utf8");
const authSource = readFileSync("lib/auth-context.tsx", "utf8");

assert.equal(
  accountSource.includes('SectionBlock title="계정 관리"'),
  false,
  "My Page should not render the account management section"
);

assert.equal(
  accountSource.includes("handleChangePassword"),
  false,
  "password change handler should be removed from My Page"
);

assert.equal(
  accountSource.includes("handleUpdateName"),
  false,
  "name update handler should be removed from My Page"
);

assert.equal(
  accountSource.includes("로그아웃"),
  true,
  "My Page should keep a logout action outside account management"
);

assert.equal(
  accountSource.includes("개인정보처리방침"),
  true,
  "My Page should keep the privacy policy link outside account management"
);

assert.equal(
  accountSource.includes("계정 및 데이터 삭제 요청"),
  true,
  "My Page should keep the account deletion request link outside account management"
);

assert.equal(
  authSource.includes("updatePassword"),
  false,
  "password update API should not remain in AuthContext"
);

console.log("ok - account management section is removed from My Page");
