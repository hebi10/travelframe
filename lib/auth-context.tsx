import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  type User
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { firebaseAuth, firestore, isFirebaseConfigured } from "@/lib/firebase";
import {
  freeSubscription,
  getUserSubscriptionState,
  isPremiumSubscription,
  type SubscriptionCheckStatus,
  type UserSubscription
} from "@/lib/subscription";

type AuthContextValue = {
  user: User | null;
  subscription: UserSubscription;
  verifiedSubscription: UserSubscription;
  cachedSubscription: UserSubscription;
  subscriptionStatus: SubscriptionCheckStatus;
  isLoggedIn: boolean;
  hasFullAccess: boolean;
  isAuthLoading: boolean;
  isFirebaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ensureFirebaseAuth = () => {
  if (!firebaseAuth) {
    throw new Error("Firebase 연결 정보가 아직 설정되지 않았습니다.");
  }

  return firebaseAuth;
};

const testAccountOverrides = new Set(["playtest@travelframe.app"]);

const hasTestAccountOverride = (user: User | null) =>
  Boolean(user?.email && testAccountOverrides.has(user.email.toLowerCase()));

const hasVerifiedProvider = (user: User | null) =>
  Boolean(user?.emailVerified) ||
  hasTestAccountOverride(user) ||
  Boolean(user?.providerData.some((provider) => provider.providerId === "google.com"));

const ensureCurrentUser = () => {
  const auth = ensureFirebaseAuth();
  if (!auth.currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  return auth.currentUser;
};

const ensureUserDocument = async (user: User) => {
  if (!firestore) {
    return;
  }

  await setDoc(
    doc(firestore, "users", user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: hasVerifiedProvider(user),
      providerIds: user.providerData.map((provider) => provider.providerId),
      lastSignInAt: user.metadata.lastSignInTime ?? null,
      updatedAt: serverTimestamp(),
      createdAt: user.metadata.creationTime ?? serverTimestamp()
    },
    { merge: true }
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [verifiedSubscription, setVerifiedSubscription] =
    useState<UserSubscription>(freeSubscription);
  const [cachedSubscription, setCachedSubscription] =
    useState<UserSubscription>(freeSubscription);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionCheckStatus>("loading");
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsAuthLoading(false);
      setSubscriptionStatus("failed");
      return;
    }

    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);

      if (nextUser) {
        setSubscriptionStatus("loading");
        setVerifiedSubscription(freeSubscription);
        try {
          await ensureUserDocument(nextUser);
        } catch {
          // User profile sync should not block local app usage.
        }

        const nextSubscriptionState = await getUserSubscriptionState(nextUser);
        setVerifiedSubscription(nextSubscriptionState.verifiedSubscription);
        setCachedSubscription(nextSubscriptionState.cachedSubscription);
        setSubscriptionStatus(nextSubscriptionState.subscriptionStatus);
      } else {
        setVerifiedSubscription(freeSubscription);
        setCachedSubscription(freeSubscription);
        setSubscriptionStatus("verified");
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = ensureFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    await ensureUserDocument(credential.user);
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    const auth = ensureFirebaseAuth();
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    await ensureUserDocument(result.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const auth = ensureFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await sendEmailVerification(credential.user);
    await ensureUserDocument(credential.user);
  }, []);

  const logOut = useCallback(async () => {
    const auth = ensureFirebaseAuth();
    await signOut(auth);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    const currentUser = ensureCurrentUser();
    await sendEmailVerification(currentUser);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const auth = ensureFirebaseAuth();
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = ensureCurrentUser();
    await currentUser.reload();
    await ensureUserDocument(currentUser);
    setSubscriptionStatus("loading");
    const nextSubscriptionState = await getUserSubscriptionState(currentUser);
    setVerifiedSubscription(nextSubscriptionState.verifiedSubscription);
    setCachedSubscription(nextSubscriptionState.cachedSubscription);
    setSubscriptionStatus(nextSubscriptionState.subscriptionStatus);
    setUser(ensureFirebaseAuth().currentUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      subscription: verifiedSubscription,
      verifiedSubscription,
      cachedSubscription,
      subscriptionStatus,
      isLoggedIn: Boolean(user),
      hasFullAccess:
        subscriptionStatus === "verified" &&
        hasVerifiedProvider(user) &&
        isPremiumSubscription(verifiedSubscription),
      isAuthLoading,
      isFirebaseReady: isFirebaseConfigured && Boolean(firebaseAuth),
      signIn,
      signInWithGoogleIdToken,
      signUp,
      logOut,
      sendVerificationEmail,
      resetPassword,
      refreshUser
    }),
    [
      cachedSubscription,
      isAuthLoading,
      logOut,
      refreshUser,
      resetPassword,
      sendVerificationEmail,
      signIn,
      signInWithGoogleIdToken,
      signUp,
      subscriptionStatus,
      user,
      verifiedSubscription
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }

  return value;
};
