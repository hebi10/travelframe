#!/usr/bin/env node
/**
 * Optional Play Console monetization configuration inspection.
 * GET-only: product catalog state, never orders, tokens, purchases or user data.
 * Does not create an edit, sign/upload AABs, change track releases or approve publication.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE = "com.haebi.photoguide";
export const EXPECTED_SUBSCRIPTIONS = Object.freeze(["creator_monthly", "plus_monthly", "expert_monthly"]);
const ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/";

function assertSafeToken(token) {
  if (typeof token !== "string" || token.length < 20 || /[\r\n]/.test(token)) {
    throw new Error("Missing or malformed short-lived Android Publisher token");
  }
}

async function requestJson(fetchImpl, url, accessToken) {
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { authorization: "Bearer " + accessToken, accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  if (!res?.ok) {
    throw new Error("Android Publisher read-only catalog query unavailable (HTTP " + (res?.status ?? "unknown") + ")");
  }
  return res.json();
}

export async function inspectStoreCatalog(accessToken, fetchImpl = fetch) {
  assertSafeToken(accessToken);
  const subscriptions = [];
  let page = "";
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    const url = new URL(ROOT + PACKAGE + "/subscriptions");
    url.searchParams.set("pageSize", "100");
    if (page) url.searchParams.set("pageToken", page);
    const data = await requestJson(fetchImpl, url.href, accessToken);
    if (!Array.isArray(data.subscriptions) && data.subscriptions !== undefined) {
      throw new Error("Unexpected subscriptions response schema");
    }
    subscriptions.push(...(data.subscriptions ?? []));
    if (!data.nextPageToken) { page = ""; break; }
    page = String(data.nextPageToken);
    if (seen.has(page)) throw new Error("Repeated monetization page token");
    seen.add(page);
  }
  if (page) throw new Error("Too many subscription pages; catalog incomplete");

  const rows = EXPECTED_SUBSCRIPTIONS.map((id) => {
    const found = subscriptions.filter((s) => s?.productId === id);
    if (found.length > 1) throw new Error("Duplicate subscription product ID in Play response");
    const plans = found[0]?.basePlans;
    if (plans !== undefined && !Array.isArray(plans)) throw new Error("Unexpected base-plan schema");
    return {
      id,
      found: found.length === 1,
      totalBasePlans: Array.isArray(plans) ? plans.length : 0,
      activeBasePlans: Array.isArray(plans) ? plans.filter((p) => p?.state === "ACTIVE").length : 0
    };
  });

  // Deprecated one-time product remains a separate Google Play API. Checking status
  // is optional: its absence/HTTP error is not evidence a historical grant was revoked.
  let retiredAdRemove = "unverified";
  try {
    const url = new URL(ROOT + PACKAGE + "/inappproducts");
    url.searchParams.set("maxResults", "1000");
    const data = await requestJson(fetchImpl, url.href, accessToken);
    if (!Array.isArray(data.inappproduct) && data.inappproduct !== undefined) {
      throw new Error("Unexpected legacy in-app product schema");
    }
    retiredAdRemove = (data.inappproduct ?? []).some((p) => p?.sku === "ad_remove")
      ? "listed-historical-sku" : "not-listed";
  } catch {
    // Intentionally do not propagate HTTP text or claim revoked entitlement.
  }

  return {
    schema: "body-frame-stage15-play-readonly-v1",
    package: PACKAGE,
    operation: "GET-only product metadata, no order/user data",
    subscriptions: rows,
    retiredAdRemove,
    allSubscriptionsHaveActiveBasePlans: rows.every((s) => s.found && s.activeBasePlans > 0),
    playConsoleUploadCertificateMatch: "unverified",
    testerPurchaseRestore: "unverified",
    firebaseRtdnDelivery: "unverified",
    safeToPublish: false
  };
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  try {
    const report = await inspectStoreCatalog(process.env.PLAY_ACCESS_TOKEN);
    fs.writeFileSync("stage15-play-catalog.json", JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(
      "Play catalog GET-only: " +
      report.subscriptions.map((s) => s.id + ":" + (s.found ? s.activeBasePlans + "-active" : "missing")).join(", ") +
      "; retired ad_remove: " + report.retiredAdRemove
    );
    console.log("No purchase/restore, upload-key Console match, release signing or publication verified");
    if (!report.allSubscriptionsHaveActiveBasePlans) process.exitCode = 1;
  } catch (error) {
    // Never log tokens, HTTP response bodies, order IDs, secret values or arbitrary URLs.
    console.error("Play catalog inspection blocked: " + (error?.message || "unknown error"));
    process.exitCode = 1;
  }
}
