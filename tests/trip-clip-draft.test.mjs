import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const draftSource = fs.readFileSync("lib/trip-clip-draft.ts", "utf8");
const tripClipSource = readTripClipSource();

for (const snippet of [
  "TRIP_CLIP_DRAFT_STORAGE_KEY",
  "travel-frame.trip-clip-draft.v1",
  "getTripClipDraft",
  "saveTripClipDraft",
  "clearTripClipDraft",
  "hasTripClipDraftContent",
  "updatedAt: new Date().toISOString()"
]) {
  assert.ok(draftSource.includes(snippet), `trip clip draft storage missing: ${snippet}`);
}

for (const snippet of [
  "@/lib/trip-clip-draft",
  "const TRIP_CLIP_DRAFT_AUTOSAVE_MS = 60000",
  "setInterval(() => {",
  "TRIP_CLIP_DRAFT_AUTOSAVE_MS",
  "persistTripClipDraft",
  "resumeTripClipDraft",
  "removeTripClipDraft",
  "showDraftPrompt",
  "임시 저장",
  "임시 저장된 영상 만들기 작업이 있습니다",
  "이어서 작업하기"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip draft UI missing: ${snippet}`);
}

console.log("ok - trip clip draft autosave and restore UI are wired");
