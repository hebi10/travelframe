import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicHostingChecks,
  evaluatePublicHostingResponse
} from "../scripts/probe-public-hosting.mjs";

const sample = buildPublicHostingChecks({
  privacyUrl: "https://example.web.app/privacy",
  appAdsText: "google.com, pub-123, DIRECT, f08c47fec0942fa0\n"
});

test("public endpoints all belong to the privacy policy origin", () => {
  assert.deepEqual(sample.map((item) => item.url), [
    "https://example.web.app/privacy",
    "https://example.web.app/privacy/photo-guide-delete-account",
    "https://example.web.app/app-ads.txt"
  ]);
});

test("verified public content requires 200, expected MIME, matching content and origin", () => {
  const check = sample[2];
  const valid = { status: 200, url: check.url, contentType: "text/plain; charset=utf-8", body: check.expected };
  assert.equal(evaluatePublicHostingResponse(check, valid).status, "verified");
  assert.equal(evaluatePublicHostingResponse(check, {...valid, status: 404}).status, "unverified");
  assert.equal(evaluatePublicHostingResponse(check, {...valid, url: "https://evil.example/app-ads.txt"}).status, "unverified");
  assert.equal(evaluatePublicHostingResponse(check, {...valid, body: "wrong publisher"}).status, "unverified");
  assert.equal(evaluatePublicHostingResponse(check, {...valid, contentType: "text/html"}).status, "unverified");
});

test("private or inaccessible websites are reported unverified, not assumed to be deployed", () => {
  assert.equal(
    evaluatePublicHostingResponse(sample[0], {error: "connection timed out"}).status,
    "unverified"
  );
});
