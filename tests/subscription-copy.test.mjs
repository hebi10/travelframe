import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkedDirs = ["app", "components", "lib"];
const checkedExtensions = new Set([".ts", ".tsx"]);
const forbiddenProductName = "영상 내보내기";
const requiredCopy = [
  {
    file: "app/(tabs)/account.tsx",
    snippets: [
      'title: "구독"',
      "구독하면 영상 저장, 클라우드 백업, 광고 제거를 함께 사용할 수 있습니다.",
      "구독 기간 동안 앱 전반의 광고 제거",
      '"구독 포함"',
      '"확인 중..."'
    ]
  },
  {
    file: "lib/subscription.ts",
    snippets: ['productName: isCreator ? "구독" : "광고 제거"']
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

console.log("ok - subscription copy describes ad removal benefit");
