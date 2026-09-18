import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkedDirs = ["app", "components", "features", "lib"];
const checkedExtensions = new Set([".ts", ".tsx"]);
const forbiddenProductName = "영상 내보내기";
const requiredCopy = [
  {
    file: "features/account/AccountScreen.tsx",
    snippets: [
      "무료 플랜은 프로젝트당 100장과 최대 10초 변화 영상을 지원합니다.",
      'SectionBlock title="현재 상태"',
      'label="현재 플랜"',
      'label="현재 프로젝트"',
      'label="현재 기록"',
      'SectionBlock title="클라우드 백업"',
      'SectionBlock title="플랜 및 결제"',
      '"구독 포함"',
      '"확인 중..."',
      '"구매하기"',
      '"구독하기"',
      "결제가 완료되었습니다.",
      "getStorePrice"
    ]
  },
  {
    file: "features/account/account-screen.constants.ts",
    snippets: [
      'title: "Pro"',
      'price: "Google Play 가격"',
      "Pro는 바디 프레임 365장 기록과 36.5초 변화 영상",
      "프로젝트당 최대 365장 기록",
      "최대 36.5초 변화 영상",
      "구독 기간 동안 앱 전반의 광고 제거",
      "클라우드 백업과 상위 기록 한도"
    ]
  },
  {
    file: "components/ad-banner.tsx",
    snippets: ["광고 제거 또는 구독 이용 시 표시되지 않습니다."]
  }
];

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (checkedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

for (const directory of checkedDirs) {
  for (const file of walk(path.join(root, directory))) {
    const source = fs.readFileSync(file, "utf8");

    assert.equal(
      source.includes(forbiddenProductName),
      false,
      `${path.relative(root, file)} still uses ${forbiddenProductName}`
    );
  }
}

for (const requirement of requiredCopy) {
  const source = fs.readFileSync(path.join(root, requirement.file), "utf8");

  for (const snippet of requirement.snippets) {
    assert.ok(
      source.includes(snippet),
      `${requirement.file} should include: ${snippet}`
    );
  }
}

console.log("ok - subscription copy describes Body Frame plans and Google Play pricing");
