import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountSource = readFileSync("features/account/AccountScreen.tsx", "utf8");
const settingsSource = readFileSync("features/settings/SettingsScreen.tsx", "utf8");

for (const [name, source] of [
  ["account", accountSource],
  ["settings", settingsSource]
]) {
  assert.ok(
    source.includes("showDeleteRequestInfo"),
    `${name} should gate the delete request page behind an explanation modal`
  );
  assert.ok(
    source.includes("백업 데이터는 설정 화면의 클라우드 백업에서 백업 데이터 삭제를 누르면 계정에서 제거됩니다."),
    `${name} should explain that backup data is removed from settings`
  );
  assert.ok(
    source.includes("안내 페이지로 이동"),
    `${name} should offer a clear action to open the related guide page`
  );
  assert.ok(
    source.includes("onRequestClose={() => setShowDeleteRequestInfo(false)}"),
    `${name} delete request modal should close safely on system dismiss`
  );
}

assert.equal(
  accountSource.includes("onPress={() => Linking.openURL(DELETE_ACCOUNT_REQUEST_URL)}"),
  false,
  "My Page delete request button should not open the guide page directly"
);

assert.equal(
  settingsSource.includes("onPress={() => Linking.openURL(DELETE_ACCOUNT_REQUEST_URL)}"),
  false,
  "Settings delete request row should not open the guide page directly"
);

console.log("ok - account delete request opens a safe-area-aware explanation modal first");
