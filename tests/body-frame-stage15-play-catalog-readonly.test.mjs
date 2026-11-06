import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { PACKAGE, EXPECTED_SUBSCRIPTIONS, inspectStoreCatalog } from "../scripts/inspect-play-catalog-readonly.mjs";

const token = "fixture-only-short-lived-token-12345";
const ok = (data) => ({ ok: true, status: 200, json: async () => data });

test("Play catalog read-only tool uses only GET and never releases, orders or writes", async () => {
  const seen = [];
  const mock = async (uri, options) => {
    const u = new URL(uri);
    seen.push({ method: options.method, path: u.pathname, redirect: options.redirect });
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.ok(u.pathname.includes("/applications/" + PACKAGE + "/"));
    assert.ok(!/orders|edits|bundles|commit|purchases/i.test(u.pathname));
    if (u.pathname.endsWith("/monetization/subscriptions")) return ok({
      subscriptions: EXPECTED_SUBSCRIPTIONS.map((productId) => ({
        productId, basePlans: [{ basePlanId: "monthly", state: "ACTIVE" }]
      }))
    });
    if (u.pathname.endsWith("/inappproducts")) return ok({
      inappproduct: [{ sku: "ad_remove", status: "inactive" }]
    });
    throw new Error("Unexpected API request");
  };
  const d = await inspectStoreCatalog(token, mock);
  assert.equal(d.package, PACKAGE);
  assert.equal(d.allSubscriptionsHaveActiveBasePlans, true);
  assert.equal(d.safeToPublish, false);
  assert.equal(d.retiredAdRemove, "listed-historical-sku");
  assert.equal(d.playConsoleUploadCertificateMatch, "unverified");
  assert.equal(d.testerPurchaseRestore, "unverified");
  assert.deepEqual(d.subscriptions.map(x => x.id), EXPECTED_SUBSCRIPTIONS);
  assert.equal(seen.length, 2);
  assert.ok(!JSON.stringify(d).includes(token));
});

test("Missing base plans and catalog errors cannot be reported as release approval", async () => {
  const d = await inspectStoreCatalog(token, async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/monetization/subscriptions"))
      return ok({ subscriptions: [{ productId: "creator_monthly", basePlans: [] }] });
    return { ok: false, status: 403 };
  });
  assert.equal(d.allSubscriptionsHaveActiveBasePlans, false);
  assert.equal(d.safeToPublish, false);
  assert.equal(d.retiredAdRemove, "unverified");
  assert.equal(d.subscriptions.filter(x => x.found).length, 1);
  await assert.rejects(inspectStoreCatalog(token, async () => ({
    ok: false, status: 403, json: async () => ({ secret: token })
  })), (e) => /HTTP 403/.test(e.message) && !e.message.includes(token));
});

test("Pagination includes expected products and rejects loops", async () => {
  const mock = async (uri) => {
    const u = new URL(uri);
    if (u.pathname.endsWith("/inappproducts")) return ok({ inappproduct: [] });
    return u.searchParams.get("pageToken")
      ? ok({ subscriptions: EXPECTED_SUBSCRIPTIONS.map(productId => ({ productId, basePlans: [{ state: "ACTIVE" }] })) })
      : ok({ subscriptions: [], nextPageToken: "next" });
  };
  assert.equal((await inspectStoreCatalog(token, mock)).allSubscriptionsHaveActiveBasePlans, true);
  await assert.rejects(inspectStoreCatalog(token, async uri => {
    if (new URL(uri).pathname.endsWith("/inappproducts")) return ok({ inappproduct: [] });
    return ok({ subscriptions: [], nextPageToken: "same" });
  }), /Repeated monetization page token/);
  await assert.rejects(inspectStoreCatalog("", mock), /short-lived/);
});

test("Play operational workflow has no publishing, signing or auto-release privilege", () => {
  const yaml = fs.readFileSync(".github/workflows/body-frame-stage15-play-ops-readonly.yml", "utf8");
  assert.ok(yaml.includes("branches: [main]"));
  assert.ok(yaml.includes("github.ref == 'refs/heads/main'"));
  assert.ok(yaml.includes("INPUT_OPERATION: inventory"));
  assert.ok(yaml.includes("scripts/check-play-upload-certificate.mjs"));
  assert.ok(yaml.includes("scripts/inspect-play-catalog-readonly.mjs"));
  assert.ok(yaml.includes("scripts/publish-play-release.mjs plan"));
  assert.ok(!yaml.includes("scripts/publish-play-release.mjs publish"));
  assert.ok(!yaml.includes(":app:bundleRelease"));
  assert.ok(!yaml.includes("prepare-play-aab.mjs signing"));
});
