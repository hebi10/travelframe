import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

assert.ok(source.includes("생성 시작"), "video creation CTA should say 생성 시작");
assert.ok(!source.includes("사진 선택"), "video creation CTA should no longer say 사진 선택");

console.log("ok - studio video creation CTA copy is stable");
