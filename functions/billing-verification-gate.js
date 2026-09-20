"use strict";

const { randomUUID } = require("crypto");

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;
const CACHE_MS = 15_000;
const LEASE_MS = 120_000;

// This collection is server-only under the Firestore default-deny rule. Store
// only token hashes, never purchase tokens or client-supplied entitlement data.
const createBillingVerificationGate = ({ db, HttpsError }) => {
  const reserve = async ({ uid, productId, tokenHash, purchaseRef }) => {
    const limitRef = db.doc(`billingVerificationLimits/${uid}`);
    const leaseId = randomUUID();
    const key = `${productId}:${tokenHash}`;
    return db.runTransaction(async (transaction) => {
      const [limitSnapshot, purchaseSnapshot] = await Promise.all([
        transaction.get(limitRef), transaction.get(purchaseRef)
      ]);
      const now = Date.now();
      const purchase = purchaseSnapshot.data();
      if (purchase?.uid && purchase.uid !== uid) {
        throw new HttpsError("permission-denied", "This Google Play purchase is already linked to another account.");
      }

      // Read the purchase mapping itself, so an RTDN refund/replacement cannot
      // leave a second, stale entitlement cache behind. Do not cache pending or
      // expired purchases: their next client retry must be allowed to recheck.
      if (purchase?.uid === uid && purchase.productId === productId &&
          purchase.active === true && !purchase.supersededBy &&
          Number.isFinite(purchase.verifiedAtMs) &&
          purchase.verifiedAtMs <= now && now - purchase.verifiedAtMs < CACHE_MS &&
          (!purchase.expiresAt || new Date(purchase.expiresAt).getTime() > now)) {
        return { cached: {
          verified: true, active: purchase.active, productId,
          status: purchase.status, expiresAt: purchase.expiresAt ?? null,
          acknowledgementState: purchase.acknowledgementState ?? null
        } };
      }

      const previous = limitSnapshot.data() ?? {};
      const leases = (Array.isArray(previous.leases) ? previous.leases : [])
        .filter((lease) => lease.expiresAtMs > now);
      if (leases.some((lease) => lease.key === key)) {
        throw new HttpsError("resource-exhausted", "Purchase verification is already in progress. Please retry shortly.");
      }
      const withinWindow = Number.isFinite(previous.windowStartedAtMs) &&
        previous.windowStartedAtMs <= now && now - previous.windowStartedAtMs < WINDOW_MS;
      const count = withinWindow ? Number(previous.count ?? 0) : 0;
      if (count >= MAX_ATTEMPTS || leases.length >= MAX_ATTEMPTS) {
        throw new HttpsError("resource-exhausted", "Too many purchase verification attempts. Please retry in a minute.");
      }
      transaction.set(limitRef, {
        windowStartedAtMs: withinWindow ? previous.windowStartedAtMs : now,
        count: count + 1,
        leases: [...leases, { key, leaseId, expiresAtMs: now + LEASE_MS }]
      });
      return { limitRef, leaseId };
    });
  };

  const release = async ({ limitRef, leaseId }) => {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(limitRef);
      const data = snapshot.data();
      if (!Array.isArray(data?.leases) || !data.leases.some((lease) => lease.leaseId === leaseId)) return;
      transaction.set(limitRef, {
        ...data,
        leases: data.leases.filter((lease) => lease.leaseId !== leaseId && lease.expiresAtMs > Date.now())
      });
    });
  };

  return { reserve, release };
};

module.exports = { createBillingVerificationGate };
