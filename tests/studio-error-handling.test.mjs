import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");

for (const snippet of [
  "const showStudioLoadError =",
  "보관함 데이터를 불러오지 못했습니다. 기기 저장 공간을 확인한 뒤 다시 시도해 주세요.",
  "try {",
  "setIsLoading(false);",
  "const deleteWorkFromLibrary = async (work: StudioWorkItem) =>",
  "작업물을 삭제하는 중입니다.",
  "작업물을 삭제하지 못했습니다. 저장 공간이나 권한 상태를 확인한 뒤 다시 시도해 주세요.",
  "const importSummary =",
  "일부 이미지는 클라우드 백업을 완료하지 못했습니다.",
  "Alert.alert(\"저장 완료\", importSummary);",
  "{imageBundleWorks.length > 0 ? (",
  "{savedVideoWorks.length > 0 ? ("
]) {
  assert.ok(source.includes(snippet), `studio error handling missing: ${snippet}`);
}

assert.equal(
  source.includes('Alert.alert("백업 실패"'),
  false,
  "studio import should not show a second backup-failure alert after save"
);

console.log("ok - studio handles library errors with customer-facing guidance");
