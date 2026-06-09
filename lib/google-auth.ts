const GOOGLE_AUTH_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token"
};

export const GOOGLE_SIGN_IN_MESSAGES = {
  missingConfig: "Google 로그인 설정값을 확인해 주세요.",
  missingCode: "Google 로그인 승인 코드를 받지 못했습니다.",
  missingToken: "Google 로그인 토큰을 받지 못했습니다.",
  success: "Google 계정으로 로그인했습니다.",
  cancelled: "Google 로그인을 취소했습니다.",
  failed: "Google 로그인 중 문제가 발생했습니다.",
  nativeUnavailable:
    "Google 로그인을 사용할 수 없습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요."
} as const;

type SignInWithGoogleAuthSessionInput = {
  webClientId?: string;
  androidClientId?: string;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
};

type GoogleSignInResult = "success" | "cancelled";

export const isGoogleSignInConfigured = ({
  androidClientId
}: Pick<SignInWithGoogleAuthSessionInput, "webClientId" | "androidClientId">) =>
  Boolean(androidClientId);

export const isGoogleAuthNativeModuleError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("ExpoWebBrowser") ||
    message.includes("native module") ||
    message.includes("Cannot find native module")
  );
};

export const getGoogleSignInErrorMessage = (
  error: unknown,
  fallback: (error: unknown) => string
) => {
  const message = error instanceof Error ? error.message : String(error);
  const knownMessages = Object.values(GOOGLE_SIGN_IN_MESSAGES);

  if (isGoogleAuthNativeModuleError(error)) {
    return GOOGLE_SIGN_IN_MESSAGES.nativeUnavailable;
  }

  if (knownMessages.includes(message as (typeof knownMessages)[number])) {
    return message;
  }

  return fallback(error);
};

export const signInWithGoogleAuthSession = async ({
  webClientId,
  androidClientId,
  signInWithGoogleIdToken
}: SignInWithGoogleAuthSessionInput): Promise<GoogleSignInResult> => {
  if (!isGoogleSignInConfigured({ webClientId, androidClientId })) {
    throw new Error(GOOGLE_SIGN_IN_MESSAGES.missingConfig);
  }

  const AuthSession = await import("expo-auth-session");
  const clientId = androidClientId!;
  const redirectUri = "com.haebi.photoguide:/oauthredirect";
  const request = new AuthSession.AuthRequest({
    clientId,
    responseType: AuthSession.ResponseType.Code,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    usePKCE: true,
    extraParams: {
      prompt: "select_account"
    }
  });
  const result = await request.promptAsync(GOOGLE_AUTH_DISCOVERY);

  if (result.type === "success") {
    if (result.params.error) {
      throw new Error(result.params.error_description ?? result.params.error);
    }

    const code = result.params.code;
    if (!code) {
      throw new Error(GOOGLE_SIGN_IN_MESSAGES.missingCode);
    }

    const token = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code,
        redirectUri,
        scopes: ["openid", "profile", "email"],
        extraParams: {
          code_verifier: request.codeVerifier ?? ""
        }
      },
      GOOGLE_AUTH_DISCOVERY
    );
    const idToken = token.idToken;
    if (!idToken) {
      throw new Error(GOOGLE_SIGN_IN_MESSAGES.missingToken);
    }

    await signInWithGoogleIdToken(idToken);
    return "success";
  }

  if (result.type === "cancel" || result.type === "dismiss") {
    return "cancelled";
  }

  throw new Error(GOOGLE_SIGN_IN_MESSAGES.failed);
};
