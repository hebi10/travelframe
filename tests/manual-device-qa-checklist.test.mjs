import assert from "node:assert/strict";
import fs from "node:fs";

const checklist = fs.readFileSync("docs/manual-device-qa.md", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.ok(readme.includes("Android 전용"), "README should state the current Android-only scope");
assert.ok(readme.includes("npm run quality"), "README should document the local quality command");
assert.ok(readme.includes("npm run android:dev"), "README should document Android dev client startup");
assert.equal(
  readme.includes("npm run start"),
  false,
  "README basic execution should not point to the generic Expo start command"
);
assert.ok(
  readme.includes("npm run quality:firebase-rules"),
  "README should document Firebase Rules checks as a separate command"
);
assert.equal(packageJson.scripts.ios, undefined, "package scripts should not expose iOS commands");
assert.equal(packageJson.scripts.web, undefined, "package scripts should not expose web commands");

for (const snippet of [
  "Android 핵심 플로우",
  "BF 모노그램",
  "첫 카메라 진입",
  "기준 사진",
  "2열 9:16 Photo Grid",
  "3열 기록 Grid",
  "사진 1장당 0.1초",
  "Google Play 구매",
  "클라우드 백업",
  "6개 그룹",
  "/legacy-studio"
]) {
  assert.ok(checklist.includes(snippet), `manual QA checklist missing: ${snippet}`);
}

for (const snippet of [
  "## Android 표시/접근성 QA",
  "360dp급 작은 화면",
  "44×44dp",
  "Safe Area",
  "다크 모드",
  "라이트 모드",
  "폴더블",
  "한쪽 면만 사용하는",
  "이전 제품 용어"
]) {
  assert.ok(checklist.includes(snippet), `manual display QA checklist missing: ${snippet}`);
}

for (const snippet of [
  "## 출시 전 브랜드 QA",
  "app-icon.png",
  "adaptive-icon.png",
  "#0B0B0C",
  "1024×1024"
]) {
  assert.ok(checklist.includes(snippet), `manual brand QA checklist missing: ${snippet}`);
}

console.log("ok - final Body Frame manual device QA checklist covers product and brand flows");
