import crypto from "node:crypto";
import fs from "node:fs";

const REVIEWED_VERSION = "0.2.2";
const REVIEWED_ORIGINAL_BLOB = "24e7db0cc55aa22d0f98358b73298067deb33b52";
const reviewedBackport = fs.readFileSync(new URL("./vendor/decode-uri-component-0.5.1.cjs", import.meta.url), "utf8");

export function patchUriDecoder(source, version) {
  if (version !== REVIEWED_VERSION) {
    throw new Error("URI decoder patch requires the reviewed CommonJS version 0.2.2");
  }
  if (source === reviewedBackport) return source;
  const bytes = Buffer.from(source, "utf8");
  const blob = crypto.createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
  if (blob !== REVIEWED_ORIGINAL_BLOB) {
    throw new Error("URI decoder patch refused unexpected installed source");
  }
  return reviewedBackport;
}

export function verifyUriDecoderPatch(source, version) {
  if (version !== REVIEWED_VERSION || source !== reviewedBackport) {
    throw new Error("Reviewed CommonJS URI decoder backport is not installed");
  }
}
