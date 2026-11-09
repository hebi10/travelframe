import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const PACKAGE = "com.haebi.photoguide";
const LOCALE = "ko-KR";
const IMAGE_TYPE = "phoneScreenshots";
const ANDROID_PUBLISHER = "https://androidpublisher.googleapis.com";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const checksum = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const safeFile = (dir, name) => path.join(dir, name);

export function validateStoreManifest(input) {
  if (input?.packageName !== PACKAGE || input?.language !== LOCALE ||
      input?.imageType !== IMAGE_TYPE || input?.width !== 1080 ||
      input?.height !== 1920 || !Array.isArray(input?.assets) ||
      input.assets.length !== 6) throw new Error("Unexpected Play store screenshot manifest");
  const usedIds = new Set();
  input.assets.forEach((asset, i) => {
    const n = i + 1;
    if (asset?.index !== n || typeof asset.fileId !== "string" ||
        !/^[\w-]{20,80}$/.test(asset.fileId) || usedIds.has(asset.fileId) ||
        !/^[a-f0-9]{64}$/.test(asset.sourceSha256 ?? "") ||
        asset.sourceWidth !== 941 || asset.sourceHeight !== 1672 ||
        asset.outputName !== '0' + n + '_TravelFrame_0' + n + '_1080x1920.png' ||
        !asset.heading?.trim()) throw new Error('Untrusted store screenshot asset ' + n);
    usedIds.add(asset.fileId);
  });
  return input;
}

export function validateRgbPng(bytes, width, height) {
  if (!Buffer.isBuffer(bytes) || bytes.length <= 40 || bytes.length > MAX_FILE_BYTES ||
      !bytes.subarray(0, 8).equals(PNG) ||
      bytes.subarray(12, 16).toString("ascii") !== "IHDR" ||
      bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height ||
      bytes[24] !== 8 || bytes[25] !== 2) throw new Error("Invalid RGB screenshot PNG");
}

async function authorizedRequest(url, token, { method="GET", data=null, mime="application/json", fetcher=fetch }={}) {
  if (!token || !url.startsWith("https://androidpublisher.googleapis.com/"))
    throw new Error("Unauthorized screenshot API request");
  const response = await fetcher(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(data === null ? {} : { 'Content-Type': mime }) },
    ...(data === null ? {} : { body: data })
  });
  if (!response.ok) throw new Error("Google screenshot API " + method + " request failed (HTTP " + response.status + ")"); 
  if (method === "DELETE" || response.status === 204) return {};
  if (url.includes("alt=media")) return Buffer.from(await response.arrayBuffer());
  const body = await response.text();
  return body ? JSON.parse(body) : {};
}

export function decodeBundledStoreImages(manifest, directory, embeddedDir) {
  validateStoreManifest(manifest);
  fs.mkdirSync(directory, { recursive: true });
  for (const asset of manifest.assets) {
    const fileName = String(asset.index).padStart(2, "0") + ".png.b64";
    const encoded = fs.readFileSync(safeFile(embeddedDir, fileName), "utf8").trim();
    if (encoded.length > 12 * 1024 * 1024 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
      throw new Error("Invalid bundled screenshot base64 " + asset.index);
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded)
      throw new Error("Noncanonical screenshot encoding " + asset.index);
    validateRgbPng(bytes, asset.sourceWidth, asset.sourceHeight);
    if (checksum(bytes) !== asset.sourceSha256)
      throw new Error("Bundled screenshot differs from the reviewed source " + asset.index);
    fs.writeFileSync(safeFile(directory, String(asset.index).padStart(2, "0") + ".png"), bytes);
    console.log("Verified bundled screenshot " + asset.index + " / 6");
  }
}

export function verifyPreparedStoreImages(manifest, directory) {
  validateStoreManifest(manifest);
  const report = JSON.parse(fs.readFileSync(safeFile(directory, "images-manifest.json"), "utf8"));
  if (report?.packageName !== PACKAGE || report.language !== LOCALE ||
      report.imageType !== IMAGE_TYPE || !Array.isArray(report.images) ||
      report.images.length !== 6) throw new Error("Prepared image provenance not valid");
  const verified = [];
  for (const asset of manifest.assets) {
    const metadata = report.images[asset.index - 1];
    if (metadata?.index !== asset.index || metadata.fileName !== asset.outputName ||
        !/^[a-f0-9]{64}$/.test(metadata.sha256 ?? "")) throw new Error("Image provenance mismatch");
    const bytes = fs.readFileSync(safeFile(directory, asset.outputName));
    validateRgbPng(bytes, manifest.width, manifest.height);
    if (bytes.length !== metadata.bytes || checksum(bytes) !== metadata.sha256)
      throw new Error("Prepared screenshot checksum mismatch");
    verified.push({ index: asset.index, name: asset.outputName, sha256: metadata.sha256, bytes });
  }
  return verified;
}

function publisherUrls(editId) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(editId ?? "")) throw new Error("Invalid Play edit ID");
  const base = ANDROID_PUBLISHER + "/androidpublisher/v3/applications/" + PACKAGE + "/edits/" + editId;
  const endpoint = base + "/listings/" + LOCALE + "/" + IMAGE_TYPE;
  const upload = ANDROID_PUBLISHER + "/upload/androidpublisher/v3/applications/" +
    PACKAGE + "/edits/" + editId + "/listings/" + LOCALE + "/" + IMAGE_TYPE + "?uploadType=media";
  return { base, endpoint, upload };
}

export async function replaceStoreImages(manifest, verified, token, receiptPath, fetcher=fetch) {
  validateStoreManifest(manifest);
  if (verified?.length !== 6 || verified.some((a, i) => a.index !== i + 1 || !Buffer.isBuffer(a.bytes)))
    throw new Error("Six reviewed screenshots required");
  const req = (url, method="GET", data=null, mime="application/json") =>
    authorizedRequest(url, token, { method, data, mime, fetcher });
  const write = (receipt) => {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  };
  const insert = await req(ANDROID_PUBLISHER + "/androidpublisher/v3/applications/" + PACKAGE + "/edits", "POST", "{}");
  const editId = insert.id;
  const { base, endpoint, upload } = publisherUrls(editId);
  let commitStarted = false;
  const receipt = { status:"preflight", packageName:PACKAGE, locale:LOCALE,
                    imageType:IMAGE_TYPE, expectedCount:6, oldIds:[], newIds:[],
                    sourceChecksums:verified.map(x=>x.sha256) };
  write(receipt);
  try {
    const listing = await req(base + "/listings");
    const languages = (listing.listings ?? []).map(x=>x.language);
    if (!languages.includes(LOCALE)) throw new Error("Existing Korean Play store listing is not present; no listing created");
    const before = await req(endpoint);
    if (!Array.isArray(before.images)) throw new Error("Existing Play screenshot inventory is invalid");
    receipt.oldIds = before.images.map(image=>image.id);
    receipt.status = "inventory-verified";
    write(receipt);
    if (before.images.length) await req(endpoint, "DELETE");
    for (const item of verified) {
      const result = await req(upload, "POST", item.bytes, "image/png");
      if (!result?.image?.id || !/^[a-zA-Z0-9_-]+$/.test(result.image.id))
        throw new Error("Play did not return an uploaded screenshot ID");
      receipt.newIds.push(result.image.id);
      write(receipt);
    }
    if (new Set(receipt.newIds).size !== 6) throw new Error("Play returned duplicate image IDs");
    const staged = await req(endpoint);
    const stagedIds = (staged.images ?? []).map(image=>image.id);
    if (JSON.stringify(stagedIds) !== JSON.stringify(receipt.newIds))
      throw new Error("Staged Play screenshot list is incomplete or unordered");
    receipt.status = "commit-outcome-unconfirmed";
    write(receipt);
    commitStarted = true;
    await req(base + ":commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW", "POST", "{}");
    receipt.status = "committed-readback-unverified";
    write(receipt);
    const nextEdit = await req(ANDROID_PUBLISHER + "/androidpublisher/v3/applications/" + PACKAGE + "/edits", "POST", "{}");
    const readback = publisherUrls(nextEdit.id);
    try {
      const after = await req(readback.endpoint);
      const afterIds = (after.images ?? []).map(image=>image.id);
      if (JSON.stringify(afterIds) !== JSON.stringify(receipt.newIds))
        throw new Error("Committed Play screenshot list did not match the six images");
    } finally {
      await req(readback.base, "DELETE").catch(() => {});
    }
    receipt.status = "committed-and-read-back";
    receipt.verifiedAt = new Date().toISOString();
    write(receipt);
    console.log("Google Play Korean phone screenshots: six images committed and read back");
    return receipt;
  } catch (error) {
    receipt.failure = error.message;
    write(receipt);
    throw error;
  } finally {
    if (!commitStarted) await req(base, "DELETE").catch(() => {});
  }
}

async function main() {
  const command = process.argv[2];
  const manifest = validateStoreManifest(JSON.parse(fs.readFileSync(process.env.STORE_MANIFEST, "utf8")));
  if (command === "download-bundled") {
    decodeBundledStoreImages(manifest, process.env.STORE_INPUT_DIR, process.env.STORE_EMBEDDED_DIR);
  } else if (command === "verify") {
    const images = verifyPreparedStoreImages(manifest, process.env.STORE_OUTPUT_DIR);
    console.log("Verified store screenshot bundle: " + images.length + " RGB images at 1080x1920");
  } else if (command === "publish") {
    const images = verifyPreparedStoreImages(manifest, process.env.STORE_OUTPUT_DIR);
    await replaceStoreImages(manifest, images, process.env.PLAY_ACCESS_TOKEN, process.env.STORE_RECEIPT_PATH);
  } else {
    throw new Error("Expected download-bundled, verify, or publish");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error("Store listing update failed: " + error.message); process.exitCode = 1; });
}
