#!/usr/bin/env node
/**
 * Inventory-only Play Console check. Play does not provide track inventory
 * outside an edits session; the session is deleted without committing.
 * Never dispatch publication or consult the publication calendar/approval gate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublisher, inspectInventory } from "./publish-play-release.mjs";

export async function readPlayInventory(environment = process.env, factory = createPublisher) {
  if (environment.GITHUB_REPOSITORY !== "hebi10/travelframe" ||
      environment.GITHUB_REF !== "refs/heads/main" ||
      !["push", "workflow_dispatch"].includes(environment.GITHUB_EVENT_NAME)) {
    throw new Error("Play inventory requires the verified repository main workflow");
  }
  const track = environment.PLAY_INTERNAL_TRACK;
  if (!["internal", "qa"].includes(track)) {
    throw new Error("PLAY_INTERNAL_TRACK must be the confirmed internal or qa track");
  }
  const token = environment.PLAY_ACCESS_TOKEN;
  if (typeof token !== "string" || token.length < 20 || /[\r\n]/.test(token)) {
    throw new Error("A short-lived Android Publisher token is required");
  }
  const result = await inspectInventory(factory(token), track);
  if (result.packageId !== "com.haebi.photoguide" || result.operation !== "inventory") {
    throw new Error("Unexpected Play inventory response");
  }
  return {
    schema: "body-frame-stage15-play-inventory-v1",
    package: result.packageId,
    operation: "temporary-edit-readback-deleted-without-commit",
    apiTracks: result.apiTracks,
    currentMaximumVersionCode: result.currentMaximumVersionCode,
    bundleCount: result.bundleCount,
    apkCount: result.apkCount,
    configuredInternalTrack: result.configuredInternalTrack,
    internalTrackReleaseStatuses: result.internalTrackReleaseStatuses,
    hasBlockingRelease: result.hasBlockingRelease,
    uploadCertificateMatchesConsole: "unverified",
    livePurchaseRestore: "unverified",
    safeToPublish: false
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const info = await readPlayInventory();
    fs.writeFileSync("stage15-play-inventory.json", JSON.stringify(info, null, 2) + "\n");
    console.log(JSON.stringify(info));
    console.log("Temporary Play inventory edit deleted without releasing a bundle or changing any track");
  } catch (error) {
    console.error("Read-only Play inventory inspection failed: " + (error?.message || "unknown error"));
    process.exitCode = 1;
  }
}
