import assert from "node:assert/strict";

import { readStudioSource } from "./studio-test-source.mjs";

const source = readStudioSource();

for (const snippet of [
  "const photoLibraryItems = photos;",
  "items={photoLibraryItems}",
  "const editedPhotos = photos.filter((photo) => photo.edited);",
  "const singleImageWorks: StudioWorkItem[] = editedPhotos.map",
  "const savedVideoWorks = videoWorks;",
  "items={savedVideoWorks}"
]) {
  assert.ok(source.includes(snippet), `studio library tabs should show backed-up items: ${snippet}`);
}

assert.ok(
  source.indexOf("const photoLibraryItems = photos;") <
    source.indexOf("const editedPhotos = photos.filter((photo) => photo.edited);"),
  "photo tab display items should be separated from edited work items"
);

console.log("ok - studio photo and video tabs include backed-up library items");
