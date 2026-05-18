import { localStorageAdapter } from "@/lib/local-storage";
import { type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import {
  emptySubscriptionProducts,
  getSubscriptionProductsFromSubscription
} from "@/lib/subscription-products";

export type SubscriptionPlan = "free" | "premium";
export type SubscriptionStatus = "inactive" | "active" | "expired";
export type SubscriptionProductId = "free" | "ad_remove" | "creator_monthly";

export type UserSubscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: "none" | "mock";
  productId: SubscriptionProductId;
  startedAt: string | null;
  expiresAt: string | null;
  lastPaymentAt: string | null;
  priceLabel: string;
  productName: string;
};

export type UserSubscriptionProducts = {
  adRemove: UserSubscription | null;
  creatorMonthly: UserSubscription | null;
};

const createSubscriptionStorageKey = (uid: string) =>
  `travel-frame.subscription.${uid}.v1`;

export const freeSubscription: UserSubscription = {
  plan: "free",
  status: "inactive",
  provider: "none",
  productId: "free",
  startedAt: null,
  expiresAt: null,
  lastPaymentAt: null,
  priceLabel: "무료",
  productName: "무료 플랜"
};

export const isPremiumSubscription = (subscription: UserSubscription | null) => {
  if (!subscription || subscription.plan !== "premium" || subscription.status !== "active") {
    return false;
  }

  if (!subscription.expiresAt) {
    return true;
  }

  return new Date(subscription.expiresAt).getTime() > Date.now();
};

export const isCreatorSubscriptionActive = (subscription: UserSubscription | null) => {
  if (!isPremiumSubscription(subscription)) {
    return false;
  }

  return subscription?.productId === "creator_monthly";
};

export const isAdFreeSubscription = (subscription: UserSubscription | null) => {
  if (!isPremiumSubscription(subscription)) {
    return false;
  }

  return (
    subscription?.productId === "ad_remove" ||
    subscription?.productId === "creator_monthly"
  );
};

export const isSubscriptionProductActive = (
  subscription: UserSubscription | null,
  productId: Exclude<SubscriptionProductId, "free">
) => isPremiumSubscription(subscription) && subscription?.productId === productId;

const parseSubscription = (value: string | null): UserSubscription => {
  if (!value) {
    return freeSubscription;
  }

  try {
    const parsed = JSON.parse(value) as Partial<UserSubscription>;
    return {
      ...freeSubscription,
      ...parsed
    };
  } catch {
    return freeSubscription;
  }
};

export const getLocalSubscription = async (uid?: string | null) => {
  if (!uid) {
    return freeSubscription;
  }

  const value = await localStorageAdapter.getItem(createSubscriptionStorageKey(uid));
  return parseSubscription(value);
};

export const getUserSubscription = async (user: User | null) => {
  if (!user) {
    return freeSubscription;
  }

  if (!firestore) {
    return getLocalSubscription(user.uid);
  }

  try {
    const snapshot = await getDoc(
      doc(firestore, "users", user.uid, "subscriptions", "current")
    );

    if (!snapshot.exists()) {
      return getLocalSubscription(user.uid);
    }

    const subscription = parseSubscription(JSON.stringify(snapshot.data()));

    if (!isCreatorSubscriptionActive(subscription)) {
      const adRemoveSnapshot = await getDoc(
        doc(firestore, "users", user.uid, "subscriptions", "ad_remove")
      );
      const adRemoveSubscription = adRemoveSnapshot.exists()
        ? parseSubscription(JSON.stringify(adRemoveSnapshot.data()))
        : null;

      if (adRemoveSubscription && isAdFreeSubscription(adRemoveSubscription)) {
        await saveLocalSubscription(user.uid, adRemoveSubscription);
        return adRemoveSubscription;
      }
    }

    await saveLocalSubscription(user.uid, subscription);
    return subscription;
  } catch {
    return getLocalSubscription(user.uid);
  }
};

export const getUserSubscriptionProducts = async (
  user: User | null
): Promise<UserSubscriptionProducts> => {
  if (!user) {
    return emptySubscriptionProducts;
  }

  if (!firestore) {
    return getSubscriptionProductsFromSubscription(await getLocalSubscription(user.uid));
  }

  try {
    const [adRemoveSnapshot, creatorSnapshot] = await Promise.all([
      getDoc(doc(firestore, "users", user.uid, "subscriptions", "ad_remove")),
      getDoc(doc(firestore, "users", user.uid, "subscriptions", "creator_monthly"))
    ]);
    const adRemove = adRemoveSnapshot.exists()
      ? parseSubscription(JSON.stringify(adRemoveSnapshot.data()))
      : null;
    const creatorMonthly = creatorSnapshot.exists()
      ? parseSubscription(JSON.stringify(creatorSnapshot.data()))
      : null;

    return {
      adRemove: isSubscriptionProductActive(adRemove, "ad_remove") ? adRemove : null,
      creatorMonthly: isSubscriptionProductActive(creatorMonthly, "creator_monthly")
        ? creatorMonthly
        : null
    };
  } catch {
    return getSubscriptionProductsFromSubscription(await getLocalSubscription(user.uid));
  }
};

const saveLocalSubscription = async (uid: string, subscription: UserSubscription) => {
  await localStorageAdapter.setItem(
    createSubscriptionStorageKey(uid),
    JSON.stringify(subscription)
  );
};

const addMonths = (date: Date, months: number) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

export const activateMockSubscription = async (
  user: User,
  productId: Exclude<SubscriptionProductId, "free"> = "creator_monthly"
) => {
  if (!firestore) {
    throw new Error("Firestore가 설정되지 않았습니다.");
  }

  const now = new Date();
  const isCreator = productId === "creator_monthly";
  const expiresAt = isCreator ? addMonths(now, 1).toISOString() : null;
  const subscription: UserSubscription = {
    plan: "premium",
    status: "active",
    provider: "mock",
    productId,
    startedAt: now.toISOString(),
    expiresAt,
    lastPaymentAt: now.toISOString(),
    priceLabel: isCreator ? "월 3,900원" : "3,900원",
    productName: isCreator ? "구독" : "광고 제거"
  };

  const currentRef = doc(firestore, "users", user.uid, "subscriptions", "current");
  const currentSnapshot = await getDoc(currentRef);
  const currentSubscription = currentSnapshot.exists()
    ? parseSubscription(JSON.stringify(currentSnapshot.data()))
    : freeSubscription;
  const shouldReplaceCurrent =
    productId === "creator_monthly" || !isCreatorSubscriptionActive(currentSubscription);

  await setDoc(
    doc(firestore, "users", user.uid, "subscriptions", productId),
    {
      ...subscription,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  if (shouldReplaceCurrent) {
    await setDoc(
      currentRef,
      {
        ...subscription,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  await addDoc(collection(firestore, "users", user.uid, "paymentEvents"), {
    type: "mock_payment_completed",
    plan: subscription.plan,
    productId: subscription.productId,
    provider: subscription.provider,
    productName: subscription.productName,
    priceLabel: subscription.priceLabel,
    amount: 3900,
    currency: "KRW",
    billingType: isCreator ? "monthly" : "one_time",
    startedAt: subscription.startedAt,
    expiresAt: subscription.expiresAt,
    createdAt: serverTimestamp()
  });

  const activeSubscription = shouldReplaceCurrent ? subscription : currentSubscription;
  await saveLocalSubscription(user.uid, activeSubscription);
  return activeSubscription;
};
