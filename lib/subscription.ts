import { localStorageAdapter } from "@/lib/local-storage";
import { type User } from "firebase/auth";
import {
  doc,
  getDoc
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import { emptySubscriptionProducts } from "@/lib/subscription-products";

export type SubscriptionPlan = "free" | "premium";
export type SubscriptionStatus = "inactive" | "active" | "expired";
export type SubscriptionProductId = "free" | "ad_remove" | "creator_monthly";

export type UserSubscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: "none" | "admin" | "google_play";
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

export type SubscriptionCheckStatus = "loading" | "verified" | "failed";

export type UserSubscriptionState = {
  verifiedSubscription: UserSubscription;
  cachedSubscription: UserSubscription;
  subscriptionStatus: Exclude<SubscriptionCheckStatus, "loading">;
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

const getVerifiedSubscriptionFromFirestore = async (user: User) => {
  if (!firestore) {
    throw new Error("Firestore is not configured.");
  }

  const [currentSnapshot, adRemoveSnapshot, creatorSnapshot] = await Promise.all([
    getDoc(doc(firestore, "users", user.uid, "subscriptions", "current")),
    getDoc(doc(firestore, "users", user.uid, "subscriptions", "ad_remove")),
    getDoc(doc(firestore, "users", user.uid, "subscriptions", "creator_monthly"))
  ]);
  const currentSubscription = currentSnapshot.exists()
    ? parseSubscription(JSON.stringify(currentSnapshot.data()))
    : freeSubscription;
  const adRemoveSubscription = adRemoveSnapshot.exists()
    ? parseSubscription(JSON.stringify(adRemoveSnapshot.data()))
    : null;
  const creatorSubscription = creatorSnapshot.exists()
    ? parseSubscription(JSON.stringify(creatorSnapshot.data()))
    : null;

  if (creatorSubscription && isSubscriptionProductActive(creatorSubscription, "creator_monthly")) {
    return creatorSubscription;
  }

  if (adRemoveSubscription && isSubscriptionProductActive(adRemoveSubscription, "ad_remove")) {
    return adRemoveSubscription;
  }

  return currentSubscription;
};

export const getUserSubscriptionState = async (
  user: User | null
): Promise<UserSubscriptionState> => {
  if (!user) {
    return {
      verifiedSubscription: freeSubscription,
      cachedSubscription: freeSubscription,
      subscriptionStatus: "verified"
    };
  }

  const cachedSubscription = await getLocalSubscription(user.uid);

  try {
    const verifiedSubscription = await getVerifiedSubscriptionFromFirestore(user);
    await saveLocalSubscription(user.uid, verifiedSubscription);

    return {
      verifiedSubscription,
      cachedSubscription: verifiedSubscription,
      subscriptionStatus: "verified"
    };
  } catch {
    return {
      verifiedSubscription: freeSubscription,
      cachedSubscription,
      subscriptionStatus: "failed"
    };
  }
};

export const getUserSubscription = async (user: User | null) => {
  const { verifiedSubscription } = await getUserSubscriptionState(user);
  return verifiedSubscription;
};

export const getUserSubscriptionProducts = async (
  user: User | null
): Promise<UserSubscriptionProducts> => {
  if (!user) {
    return emptySubscriptionProducts;
  }

  if (!firestore) {
    return emptySubscriptionProducts;
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
    return emptySubscriptionProducts;
  }
};

const saveLocalSubscription = async (uid: string, subscription: UserSubscription) => {
  await localStorageAdapter.setItem(
    createSubscriptionStorageKey(uid),
    JSON.stringify(subscription)
  );
};
