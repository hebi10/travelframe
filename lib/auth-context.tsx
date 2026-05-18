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
  getUserSubscription,
  isPremiumSubscription,
  type UserSubscription
} from "@/lib/subscription";

type AuthContextValue = {
  user: User | null;
  subscription: UserSubscription;
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
  const [subscription, setSubscription] = useState<UserSubscription>(freeSubscription);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsAuthLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);

      if (nextUser) {
        try {
          await ensureUserDocument(nextUser);
          setSubscription(await getUserSubscription(nextUser));
        } catch {
          // User profile sync should not block local app usage.
        }
      } else {
        setSubscription(freeSubscription);
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
    setSubscription(await getUserSubscription(currentUser));
    setUser(ensureFirebaseAuth().currentUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      subscription,
      isLoggedIn: Boolean(user),
      hasFullAccess:
        hasTestAccountOverride(user) ||
        (hasVerifiedProvider(user) && isPremiumSubscription(subscription)),
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
      isAuthLoading,
      logOut,
      refreshUser,
      resetPassword,
      sendVerificationEmail,
      signIn,
      signInWithGoogleIdToken,
      signUp,
      subscription,
      user
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
