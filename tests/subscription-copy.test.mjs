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
      'title: "Pro"',
      "Pro는 주 15회 영상 출력, 워터마크 제거, 클라우드 백업, 광고 제거를 함께 제공합니다.",
      "구독 기간 동안 앱 전반의 광고 제거",
      "영상 출력 주 15회",
      "서버 백업 총 2GB",
      '"구독 포함"',
      '"확인 중..."',
      '"구매하기"',
      '"구독하기"',
      "결제가 완료되었습니다."
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
  const source = [
    fs.readFileSync(path.join(root, requirement.file), "utf8"),
    requirement.file === "features/account/AccountScreen.tsx"
      ? fs.readFileSync(path.join(root, "features/account/account-screen.constants.ts"), "utf8")
      : ""
  ].join("\n");

  for (const snippet of requirement.snippets) {
    assert.ok(
      source.includes(snippet),
      `${requirement.file} should include: ${snippet}`
    );
  }
}

console.log("ok - subscription copy describes Pro plan benefits and ad removal");
