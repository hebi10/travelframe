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
  useRef,
  useState,
  type ReactNode
} from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { checkLocalLibraryAccess, claimLocalLibrary, type LocalLibraryAccess } from "@/lib/local-library-owner";
import { signInWithGoogleAuthSession } from "@/lib/google-auth";

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
  const [libraryAccess, setLibraryAccess] = useState<LocalLibraryAccess | "checking" | "error">("checking");
  const authGeneration = useRef(0);
  const [gateEmail, setGateEmail] = useState("");
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateBusy, setGateBusy] = useState(false);

  useEffect(() => {
    const handleAuthChange = async (nextUser: User | null) => {
      const generation = ++authGeneration.current;
      const current = () => generation === authGeneration.current;
      setLibraryAccess("checking");
      setIsAuthLoading(true);
      setUser(nextUser);
      setGatePassword("");
      setGateError("");
      setVerifiedSubscription(freeSubscription);
      setCachedSubscription(freeSubscription);
      try {
        const access = await checkLocalLibraryAccess(nextUser?.uid ?? null);
        if (!current()) return;
        setLibraryAccess(access);
        setIsAuthLoading(false);
      } catch {
        if (!current()) return;
        setLibraryAccess("error");
        setIsAuthLoading(false);
      }

      if (nextUser) {
        setSubscriptionStatus("loading");
        setVerifiedSubscription(freeSubscription);
        try {
          await ensureUserDocument(nextUser);
        } catch {
          // User profile sync should not block local app usage.
        }
        if (!current()) return;
        try {
          const nextSubscriptionState = await getUserSubscriptionState(nextUser);
          if (!current()) return;
          setVerifiedSubscription(nextSubscriptionState.verifiedSubscription);
          setCachedSubscription(nextSubscriptionState.cachedSubscription);
          setSubscriptionStatus(nextSubscriptionState.subscriptionStatus);
        } catch {
          if (current()) setSubscriptionStatus("failed");
        }
      } else {
        setVerifiedSubscription(freeSubscription);
        setCachedSubscription(freeSubscription);
        setSubscriptionStatus("verified");
      }
    };
    if (!firebaseAuth) {
      void handleAuthChange(null);
      return () => { authGeneration.current += 1; };
    }
    const unsubscribe = onAuthStateChanged(firebaseAuth, handleAuthChange);
    return () => { authGeneration.current += 1; unsubscribe(); };
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
    const generation = authGeneration.current;
    const current = () => generation === authGeneration.current && firebaseAuth?.currentUser?.uid === currentUser.uid;
    await currentUser.reload();
    if (!current()) return;
    await ensureUserDocument(currentUser);
    if (!current()) return;
    setSubscriptionStatus("loading");
    const nextSubscriptionState = await getUserSubscriptionState(currentUser);
    if (!current()) return;
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

  const runGateAction = async (action: () => Promise<void>) => {
    setGateBusy(true);
    setGateError("");
    try { await action(); }
    catch { setGateError("처리하지 못했습니다. 로그인 정보와 연결 상태를 확인해 주세요."); }
    finally { setGateBusy(false); }
  };
  const gateButton = (label: string, action: () => Promise<void>) => (
    <Pressable accessibilityRole="button" disabled={gateBusy} onPress={() => void runGateAction(action)}
      style={{ padding: 16, borderRadius: 8, backgroundColor: "#e8e8e8", marginTop: 12, opacity: gateBusy ? 0.5 : 1 }}>
      <Text style={{ color: "#111", textAlign: "center", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  return <AuthContext.Provider value={value}>
    {libraryAccess === "allowed" ? <View key={user?.uid ?? "guest"} style={{ flex: 1 }}>{children}</View> :
      <ScrollView style={{ flex: 1, backgroundColor: "#111" }} contentContainerStyle={{ padding: 24, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 16 }}>기기 기록 보호</Text>
        {libraryAccess === "checking" ? <ActivityIndicator color="#fff" /> : <>
          <Text style={{ color: "#ddd", lineHeight: 24 }}>{libraryAccess === "claim-required"
            ? "이 기기에 기존 사진과 기록이 있습니다. 본인의 기록이 맞는지 확인한 뒤 현재 계정에 연결해 주세요. 연결 후에는 이 계정으로 로그인해야 기록을 사용할 수 있습니다."
            : libraryAccess === "error" ? "기록의 계정 정보를 확인하지 못했습니다. 앱을 다시 실행해 주세요. 기록은 보존되어 있습니다."
            : "이 기기의 기록은 이전에 연결한 계정으로만 사용할 수 있습니다. 해당 계정으로 로그인해 주세요. 사진과 기록은 삭제되지 않았습니다."}</Text>
          {user && <Text style={{ color: "#ddd", marginTop: 12 }}>{user.email ?? "현재 로그인된 계정"}</Text>}
          {libraryAccess === "claim-required" && user && gateButton("내 기록이 맞습니다 · 이 계정에 연결", async () => {
            const uid = user.uid;
            const generation = authGeneration.current;
            if (firebaseAuth?.currentUser?.uid !== uid) return;
            await claimLocalLibrary(uid);
            if (generation === authGeneration.current && firebaseAuth?.currentUser?.uid === uid) setLibraryAccess("allowed");
          })}
          {user ? gateButton("로그아웃", logOut) : libraryAccess === "locked" && <>
            <TextInput accessibilityLabel="이메일" placeholder="이메일" placeholderTextColor="#999" autoCapitalize="none" keyboardType="email-address" value={gateEmail} onChangeText={setGateEmail} style={{ color: "#fff", borderColor: "#666", borderWidth: 1, padding: 14, marginTop: 20 }} />
            <TextInput accessibilityLabel="비밀번호" placeholder="비밀번호" placeholderTextColor="#999" secureTextEntry value={gatePassword} onChangeText={setGatePassword} style={{ color: "#fff", borderColor: "#666", borderWidth: 1, padding: 14, marginTop: 10 }} />
            {gateButton("이메일로 로그인", () => signIn(gateEmail, gatePassword))}
            {gateButton("Google로 로그인", async () => { await signInWithGoogleAuthSession({ androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, signInWithGoogleIdToken }); })}
            {gateButton("비밀번호 재설정 메일 받기", () => resetPassword(gateEmail))}
          </>}
          {gateError ? <Text accessibilityRole="alert" style={{ color: "#ffb4b4", marginTop: 16 }}>{gateError}</Text> : null}
        </>}
      </ScrollView>}
  </AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }

  return value;
};
