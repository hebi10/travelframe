import assert from "node:assert/strict";
import fs from "node:fs";

const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const photoTypesSource = fs.readFileSync("types/photo.ts", "utf8");

for (const snippet of [
  "targetPhotoId,",
  "const id = targetPhotoId ?? createPhotoId()",
  "const existingPhoto = targetPhotoId",
  "photos.find((photo) => photo.id === targetPhotoId)",
  "targetPhotoId && existingPhoto",
  "photos.map((item) => (item.id === targetPhotoId ? photo : item))"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `edited photo overwrite flow missing: ${snippet}`);
}

for (const snippet of [
  "targetPhotoId?: string",
  "replaceCreatedAt?: string"
]) {
  assert.ok(photoTypesSource.includes(snippet), `edited photo overwrite input type missing: ${snippet}`);
}

for (const snippet of [
  'type SaveEditMode = "new" | "overwrite"',
  "const canOverwriteSource = Boolean(sourcePhoto?.edited)",
  "const confirmSaveEdit = () =>",
  "Alert.alert(",
  '"덮어쓰기"',
  '"새로 저장"',
  'executeSaveEdit("overwrite")',
  'executeSaveEdit("new")',
  'mode === "overwrite" ? sourcePhoto?.sourcePhotoId : source.sourcePhotoId',
  'targetPhotoId: mode === "overwrite" ? sourcePhoto?.id : undefined',
  'replaceCreatedAt: mode === "overwrite" ? sourcePhoto?.createdAt : undefined'
]) {
  assert.ok(editSource.includes(snippet), `edit overwrite confirmation missing: ${snippet}`);
}

console.log("ok - re-editing a completed photo can choose overwrite or create new");
