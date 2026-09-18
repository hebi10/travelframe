"use strict";

const crypto = require("crypto");
const { GoogleAuth } = require("google-auth-library");
const {
  getEffectiveSubscription,
  isActiveSubscriptionDocument,
  parseOneTimePurchase,
  parseSubscriptionPurchase
} = require("./google-play-billing-policy");

const GOOGLE_PLAY_PACKAGE_NAME = "com.haebi.photoguide";
const GOOGLE_PLAY_TOPIC = "google-play-billing";
const ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";
const ANDROID_PUBLISHER_BASE =
  "https://androidpublisher.googleapis.com/androidpublisher/v3";

const PRODUCT_META = {
  ad_remove: {
    kind: "in-app",
    productName: "광고 제거",
    priceLabel: "Google Play 결제"
  },
  creator_monthly: {
    kind: "subs",
    productName: "Pro",
    priceLabel: "Google Play 월 구독"
  },
  expert_monthly: {
    kind: "subs",
    productName: "Expert",
    priceLabel: "Google Play 월 구독"
  }
};
const PRODUCT_IDS = Object.keys(PRODUCT_META);

const hashPurchaseToken = (purchaseToken) =>
  crypto.createHash("sha256").update(purchaseToken).digest("hex");

const createFreeSubscription = () => ({
  plan: "free",
  productId: "free",
  status: "inactive",
  provider: "none",
  startedAt: null,
  expiresAt: null,
  lastPaymentAt: null,
  priceLabel: "무료",
  productName: "무료 플랜"
});

const createGooglePlayBillingService = ({
  admin,
  db,
  FieldValue,
  HttpsError
}) => {
  const auth = new GoogleAuth({ scopes: [ANDROID_PUBLISHER_SCOPE] });
  let authClientPromise = null;

  const getAuthClient = () => {
    authClientPromise ??= auth.getClient();
    return authClientPromise;
  };

  const googleRequest = async ({ method = "GET", url, data }) => {
    const client = await getAuthClient();
    const response = await client.request({
      method,
      url,
      ...(data === undefined ? {} : { data })
    });
    return response.data ?? {};
  };

  const getProductMeta = (productId) => {
    const meta = PRODUCT_META[productId];
    if (!meta) {
      throw new HttpsError("invalid-argument", "Unsupported Google Play product.");
    }
    return meta;
  };

  const assertPurchaseToken = (purchaseToken) => {
    if (
      typeof purchaseToken !== "string" ||
      purchaseToken.length < 20 ||
      purchaseToken.length > 4096
    ) {
      throw new HttpsError("invalid-argument", "A valid purchaseToken is required.");
    }
  };

  const verifyExternalAccount = ({ result, uid }) => {
    if (result.externalAccountId && result.externalAccountId !== uid) {
      throw new HttpsError(
        "permission-denied",
        "This Google Play purchase belongs to another account."
      );
    }
  };

  const fetchGooglePurchase = async ({ productId, purchaseToken }) => {
    const meta = getProductMeta(productId);
    assertPurchaseToken(purchaseToken);
    const encodedToken = encodeURIComponent(purchaseToken);

    if (meta.kind === "subs") {
      const data = await googleRequest({
        url:
          `${ANDROID_PUBLISHER_BASE}/applications/${GOOGLE_PLAY_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodedToken}`
      });
      return {
        meta,
        data,
        result: parseSubscriptionPurchase({ data, productId })
      };
    }

    const data = await googleRequest({
      url:
        `${ANDROID_PUBLISHER_BASE}/applications/${GOOGLE_PLAY_PACKAGE_NAME}/purchases/productsv2/tokens/${encodedToken}`
    });
    return {
      meta,
      data,
      result: parseOneTimePurchase({ data, productId })
    };
  };

  const acknowledgeGooglePurchase = async ({
    productId,
    purchaseToken,
    kind
  }) => {
    const encodedProductId = encodeURIComponent(productId);
    const encodedToken = encodeURIComponent(purchaseToken);
    const path =
      kind === "subs"
        ? `purchases/subscriptions/${encodedProductId}/tokens/${encodedToken}:acknowledge`
        : `purchases/products/${encodedProductId}/tokens/${encodedToken}:acknowledge`;

    await googleRequest({
      method: "POST",
      url:
        `${ANDROID_PUBLISHER_BASE}/applications/${GOOGLE_PLAY_PACKAGE_NAME}/${path}`,
      data: {}
    });
  };

  const buildGoogleSubscription = ({
    productId,
    result,
    meta,
    tokenHash,
    source
  }) => ({
    plan: result.active ? "premium" : "free",
    productId,
    status: result.status,
    provider: "google_play",
    startedAt: result.startedAt ?? null,
    expiresAt: result.expiresAt ?? null,
    lastPaymentAt: result.active ? new Date().toISOString() : null,
    priceLabel: meta.priceLabel,
    productName: meta.productName,
    googleState: result.googleState,
    googleOrderId: result.orderId,
    googlePurchaseTokenHash: tokenHash,
    acknowledgementState: result.acknowledgementState,
    verificationSource: source,
    updatedAt: FieldValue.serverTimestamp()
  });

  const syncGooglePlayPurchase = async ({
    uid,
    productId,
    purchaseToken,
    source = "client",
    acknowledge = false
  }) => {
    if (typeof uid !== "string" || !uid) {
      throw new HttpsError("unauthenticated", "Login is required.");
    }
    const meta = getProductMeta(productId);
    assertPurchaseToken(purchaseToken);
    const tokenHash = hashPurchaseToken(purchaseToken);
    const purchaseRef = db.doc(`googlePlayPurchases/${tokenHash}`);
    const existingOwner = await purchaseRef.get();

    if (
      existingOwner.exists &&
      existingOwner.data()?.uid &&
      existingOwner.data().uid !== uid
    ) {
      throw new HttpsError(
        "permission-denied",
        "This Google Play purchase is already linked to another account."
      );
    }

    const { result } = await fetchGooglePurchase({
      productId,
      purchaseToken
    });

    if (!result.verified) {
      throw new HttpsError(
        "failed-precondition",
        "Google Play did not return the expected product."
      );
    }
    verifyExternalAccount({ result, uid });

    let acknowledgementState = result.acknowledgementState;
    if (acknowledge && result.active && !result.acknowledged) {
      await acknowledgeGooglePurchase({
        productId,
        purchaseToken,
        kind: meta.kind
      });
      acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    }

    const productIds = ["ad_remove", "creator_monthly", "expert_monthly"];
    const productRefs = Object.fromEntries(
      productIds.map((id) => [
        id,
        db.doc(`users/${uid}/subscriptions/${id}`)
      ])
    );
    const currentRef = db.doc(`users/${uid}/subscriptions/current`);
    const eventRef = db.collection(`users/${uid}/paymentEvents`).doc();
    const linkedHash = result.linkedPurchaseToken
      ? hashPurchaseToken(result.linkedPurchaseToken)
      : null;
    const linkedRef = linkedHash
      ? db.doc(`googlePlayPurchases/${linkedHash}`)
      : null;

    await db.runTransaction(async (transaction) => {
      const refsToRead = [
        purchaseRef,
        ...productIds.map((id) => productRefs[id])
      ];
      if (linkedRef) refsToRead.push(linkedRef);
      const snapshots = await Promise.all(
        refsToRead.map((ref) => transaction.get(ref))
      );

      const purchaseSnapshot = snapshots[0];
      if (
        purchaseSnapshot.exists &&
        purchaseSnapshot.data()?.uid &&
        purchaseSnapshot.data().uid !== uid
      ) {
        throw new HttpsError(
          "permission-denied",
          "This Google Play purchase is already linked to another account."
        );
      }

      const productSnapshots = snapshots.slice(1, 1 + productIds.length);
      const currentProducts = Object.fromEntries(
        productIds.map((id, index) => [
          id,
          productSnapshots[index].exists
            ? productSnapshots[index].data()
            : null
        ])
      );

      const existingProduct = currentProducts[productId];
      const keepAdminOverride =
        existingProduct?.provider === "admin" &&
        isActiveSubscriptionDocument(existingProduct);

      const googleSubscription = buildGoogleSubscription({
        productId,
        result: {
          ...result,
          acknowledgementState
        },
        meta,
        tokenHash,
        source
      });
      const nextProduct = keepAdminOverride
        ? existingProduct
        : googleSubscription;
      const nextProducts = {
        ...currentProducts,
        [productId]: nextProduct
      };
      const effective = getEffectiveSubscription(nextProducts);

      if (!keepAdminOverride) {
        transaction.set(productRefs[productId], googleSubscription, {
          merge: true
        });
      }
      transaction.set(
        currentRef,
        effective ?? createFreeSubscription(),
        { merge: false }
      );

      transaction.set(
        purchaseRef,
        {
          uid,
          productId,
          packageName: GOOGLE_PLAY_PACKAGE_NAME,
          provider: "google_play",
          purchaseToken,
          tokenHash,
          status: result.status,
          active: result.active,
          googleState: result.googleState,
          orderId: result.orderId,
          expiresAt: result.expiresAt,
          linkedPurchaseTokenHash: linkedHash,
          acknowledgementState,
          source,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt:
            purchaseSnapshot.exists
              ? purchaseSnapshot.data()?.createdAt ??
                FieldValue.serverTimestamp()
              : FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      if (linkedRef) {
        const linkedSnapshot =
          snapshots[1 + productIds.length] ?? null;
        if (
          linkedSnapshot?.exists &&
          linkedSnapshot.data()?.uid === uid
        ) {
          transaction.set(
            linkedRef,
            {
              supersededBy: tokenHash,
              updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
      }

      transaction.set(eventRef, {
        type: "google_play_purchase_synced",
        productId,
        productName: meta.productName,
        status: result.status,
        active: result.active,
        provider: "google_play",
        source,
        tokenHash,
        googleState: result.googleState,
        orderId: result.orderId,
        expiresAt: result.expiresAt,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return {
      verified: true,
      active: result.active,
      productId,
      status: result.status,
      expiresAt: result.expiresAt,
      acknowledgementState
    };
  };

  const parseRtdnPayload = (payload) => {
    if (!payload || payload.packageName !== GOOGLE_PLAY_PACKAGE_NAME) {
      return null;
    }
    if (payload.testNotification) {
      return { test: true };
    }

    if (payload.subscriptionNotification) {
      return {
        purchaseToken: payload.subscriptionNotification.purchaseToken,
        productId: payload.subscriptionNotification.subscriptionId ?? null,
        notificationType: payload.subscriptionNotification.notificationType,
        kind: "subs"
      };
    }

    if (payload.oneTimeProductNotification) {
      return {
        purchaseToken: payload.oneTimeProductNotification.purchaseToken,
        productId: payload.oneTimeProductNotification.sku ?? null,
        notificationType: payload.oneTimeProductNotification.notificationType,
        kind: "in-app"
      };
    }

    if (payload.voidedPurchaseNotification) {
      return {
        purchaseToken: payload.voidedPurchaseNotification.purchaseToken,
        productId: null,
        notificationType: "voided",
        kind:
          payload.voidedPurchaseNotification.productType === 1
            ? "subs"
            : "in-app"
      };
    }

    return null;
  };

  const handleGooglePlayBillingNotification = async (payload) => {
    const notification = parseRtdnPayload(payload);
    if (!notification) {
      return { ignored: true };
    }
    if (notification.test) {
      return { test: true };
    }

    const purchaseToken = notification.purchaseToken;
    if (typeof purchaseToken !== "string" || !purchaseToken) {
      return { ignored: true };
    }

    const tokenHash = hashPurchaseToken(purchaseToken);
    const purchaseRef = db.doc(`googlePlayPurchases/${tokenHash}`);
    const purchaseSnapshot = await purchaseRef.get();

    if (!purchaseSnapshot.exists) {
      await db.doc(`unresolvedGooglePlayNotifications/${tokenHash}`).set(
        {
          packageName: GOOGLE_PLAY_PACKAGE_NAME,
          purchaseToken,
          tokenHash,
          productId: notification.productId,
          kind: notification.kind,
          notificationType: notification.notificationType,
          receivedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return { unresolved: true };
    }

    const mapping = purchaseSnapshot.data();
    const productId =
      notification.productId && PRODUCT_IDS.includes(notification.productId)
        ? notification.productId
        : mapping.productId;

    if (!PRODUCT_IDS.includes(productId)) {
      return { ignored: true };
    }

    return syncGooglePlayPurchase({
      uid: mapping.uid,
      productId,
      purchaseToken,
      source: "rtdn",
      acknowledge: true
    });
  };

  return {
    GOOGLE_PLAY_PACKAGE_NAME,
    GOOGLE_PLAY_TOPIC,
    PRODUCT_IDS,
    handleGooglePlayBillingNotification,
    syncGooglePlayPurchase
  };
};

module.exports = {
  GOOGLE_PLAY_PACKAGE_NAME,
  GOOGLE_PLAY_TOPIC,
  PRODUCT_IDS,
  createGooglePlayBillingService,
  hashPurchaseToken
};
