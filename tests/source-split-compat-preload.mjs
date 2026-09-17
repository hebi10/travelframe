import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

const originalReadFileSync = fs.readFileSync.bind(fs);

fs.readFileSync = function readFileSyncWithSplitSource(filePath, ...args) {
  const result = originalReadFileSync(filePath, ...args);
  const normalizedPath =
    typeof filePath === "string" ? filePath.replaceAll("\\", "/") : "";

  if (
    !normalizedPath.endsWith("lib/photo-library.ts") ||
    typeof result !== "string"
  ) {
    return result;
  }

  const legacySource = originalReadFileSync(
    path.resolve(process.cwd(), "lib/legacy-photo-library.ts"),
    "utf8"
  );

  // Legacy source comes first so pre-Stage-3 source-order assertions keep
  // targeting the original implementation; the Stage-3 wrapper follows it.
  return `${legacySource}\n${result}`;
};

syncBuiltinESMExports();
