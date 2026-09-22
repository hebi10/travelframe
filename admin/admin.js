import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-functions.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDqRwnf6BYjp9Np2UcUA4wNvlK-rwpiLDM",
  authDomain: "travelframe-4e1fb.firebaseapp.com",
  projectId: "travelframe-4e1fb",
  storageBucket: "travelframe-4e1fb.firebasestorage.app",
  messagingSenderId: "453199311544",
  appId: "1:453199311544:web:101d6cbe6dbf99de043a4d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "ko";
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

const $ = (id) => document.getElementById(id);

const loginPanel = $("loginPanel");
const adminPanel = $("adminPanel");
const authLoadingPanel = $("authLoadingPanel");
const userPanel = $("userPanel");
const subscriptionPanel = $("subscriptionPanel");
const backupPanel = $("backupPanel");

let currentAdmin = null;
let currentUserDoc = null;
let currentSubscription = null;
let currentProductSubscriptions = {
  ad_remove: null,
  creator_monthly: null,
  plus_monthly: null,
  expert_monthly: null
};
let currentBackup = null;
let currentBackupProjectSlots = [];
let currentBodyProjects = [];
let currentProjectBackupStats = {};
let activeBackupTab = "image";
let backupItemsByTab = {
  image: [],
  video: [],
  music: []
};
let backupPagesByTab = {
  image: 1,
  video: 1,
  music: 1
};
let loadedBackupTabs = {
  image: false,
  video: false,
  music: false
};
let isCreatingRegularAccount = false;
let allUsers = [];
let usersPage = 1;
const usersPageSize = 10;
const backupTabs = ["image", "video", "music"];
const backupPageSize = 10;
const backupTabLabels = {
  image: "이미지",
  video: "동영상",
  music: "음악"
};
const backupUploadAccept = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4",
  music: "audio/*"
};
const reserveAdminBackupUpload = httpsCallable(functions, "reserveAdminBackupUpload");
const completeAdminBackupUpload = httpsCallable(functions, "completeAdminBackupUpload");
const deleteAdminBackupItem = httpsCallable(functions, "deleteAdminBackupItem");
const replaceAdminCloudBackupProject = httpsCallable(
  functions,
  "replaceAdminCloudBackupProject"
);
const deleteAdminCloudBackupData = httpsCallable(
  functions,
  "deleteAdminCloudBackupData"
);
const setAdminProductSubscription = httpsCallable(functions, "setAdminProductSubscription");
const setAdminBackupStatus = httpsCallable(functions, "setAdminBackupStatus");

const productMeta = {
  ad_remove: {
    cardId: "adRemoveCard",
    statusId: "adRemoveStatusLabel",
    detailId: "adRemoveDetail",
    productName: "광고 제거",
    priceLabel: "2,000원",
    description: "1회 결제 상품입니다. 무료 플랜 한도는 유지하고 광고만 제거합니다."
  },
  creator_monthly: {
    cardId: "creatorMonthlyCard",
    statusId: "creatorMonthlyStatusLabel",
    detailId: "creatorMonthlyDetail",
    productName: "Pro",
    priceLabel: "월 1,990원",
    description: "로컬 무제한과 클라우드 백업 프로젝트 1개를 제공합니다."
  },
  plus_monthly: {
    cardId: "plusMonthlyCard",
    statusId: "plusMonthlyStatusLabel",
    detailId: "plusMonthlyDetail",
    productName: "Plus",
    priceLabel: "월 3,990원",
    description: "로컬 무제한과 클라우드 백업 프로젝트 최대 3개를 제공합니다."
  },
  expert_monthly: {
    cardId: "expertMonthlyCard",
    statusId: "expertMonthlyStatusLabel",
    detailId: "expertMonthlyDetail",
    productName: "Expert",
    priceLabel: "월 5,990원",
    description: "로컬 무제한과 클라우드 백업 프로젝트 최대 5개를 제공합니다."
  }
};

const paidProductIds = [
  "ad_remove",
  "creator_monthly",
  "plus_monthly",
  "expert_monthly"
];

const statusLabels = {
  inactive: "비활성",
  active: "활성",
  expired: "만료"
};

const weeklyVideoExportLimits = {
  free: 1,
  ad_remove: 1,
  pro: 15,
  plus: 15,
  expert: 15
};

const adminPlanLabels = {
  free: "무료",
  ad_remove: "광고 제거",
  pro: "Pro",
  plus: "Plus",
  expert: "Expert"
};

const adminPlanPolicies = {
  free: {
    localUsage: "프로젝트 1개 · 사진 100장",
    maxCloudBackupProjects: 0,
    maxCloudPhotosPerProject: 0,
    weeklyVideoExportLimit: 1,
    visualPolicy: "광고 표시 · 워터마크 표시"
  },
  ad_remove: {
    localUsage: "프로젝트 1개 · 사진 100장",
    maxCloudBackupProjects: 0,
    maxCloudPhotosPerProject: 0,
    weeklyVideoExportLimit: 1,
    visualPolicy: "광고 없음 · 워터마크 표시"
  },
  pro: {
    localUsage: "로컬 프로젝트·사진 무제한",
    maxCloudBackupProjects: 1,
    maxCloudPhotosPerProject: 365,
    weeklyVideoExportLimit: 15,
    visualPolicy: "광고 없음 · 워터마크 없음"
  },
  plus: {
    localUsage: "로컬 프로젝트·사진 무제한",
    maxCloudBackupProjects: 3,
    maxCloudPhotosPerProject: 365,
    weeklyVideoExportLimit: 15,
    visualPolicy: "광고 없음 · 워터마크 없음"
  },
  expert: {
    localUsage: "로컬 프로젝트·사진 무제한",
    maxCloudBackupProjects: 5,
    maxCloudPhotosPerProject: 365,
    weeklyVideoExportLimit: 15,
    visualPolicy: "광고 없음 · 워터마크 없음"
  }
};

const productPlanTiers = {
  ad_remove: "ad_remove",
  creator_monthly: "pro",
  plus_monthly: "plus",
  expert_monthly: "expert"
};

const getPlanPolicy = (tier) => adminPlanPolicies[tier] ?? adminPlanPolicies.free;

const setupSubscriptionPanel = () => {
  subscriptionPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">SUBSCRIPTION</p>
        <h2>구독 관리</h2>
      </div>
      <span id="weeklyVideoUsageMeta" class="pill">-</span>
    </div>
    <div id="weeklyVideoUsageCard" class="usage-strip">
      <div>
        <span class="meta">이번 주 영상 출력</span>
        <strong id="weeklyVideoRemaining">-</strong>
      </div>
      <div class="usage-progress">
        <div class="usage-meter" aria-hidden="true">
          <span id="weeklyVideoUsageFill"></span>
        </div>
        <span id="weeklyVideoUsageDetail" class="meta">사용량을 불러오면 표시됩니다.</span>
      </div>
    </div>
    <div id="selectedPlanEntitlementPreview" class="plan-entitlement-grid" aria-label="선택 플랜 권한">
      <div class="entitlement-item">
        <span class="meta">로컬 프로젝트·사진</span>
        <strong id="selectedLocalUsagePolicy">-</strong>
      </div>
      <div class="entitlement-item">
        <span class="meta">클라우드 프로젝트</span>
        <strong id="selectedCloudProjectPolicy">-</strong>
      </div>
      <div class="entitlement-item">
        <span class="meta">프로젝트당 사진</span>
        <strong id="selectedCloudPhotoPolicy">-</strong>
      </div>
      <div class="entitlement-item">
        <span class="meta">주간 영상 출력</span>
        <strong id="selectedVideoExportPolicy">-</strong>
      </div>
      <div class="entitlement-item">
        <span class="meta">광고 · 워터마크</span>
        <strong id="selectedVisualPolicy">-</strong>
      </div>
    </div>
    <form id="subscriptionForm" class="form form-grid">
      <label>
        관리할 상품
        <select id="productSelect">
          <option value="ad_remove">광고 제거 1회 결제</option>
          <option value="creator_monthly">Pro 월결제</option>
          <option value="plus_monthly">Plus 월결제</option>
          <option value="expert_monthly">Expert 월결제</option>
        </select>
      </label>
      <label>
        상태
        <select id="productStatusSelect">
          <option value="inactive">비활성</option>
          <option value="active">활성</option>
          <option value="expired">만료</option>
        </select>
      </label>
      <label>
        만료일
        <input id="productExpiresInput" type="date" />
      </label>
      <label class="full">
        관리자 메모
        <textarea id="adminNoteInput" placeholder="처리 사유, 테스트 계정 메모 등을 남겨 주세요."></textarea>
      </label>
      <div class="row form-actions full">
        <button type="submit">상품 상태 저장</button>
        <button id="resetWeeklyVideoExportButton" class="secondary" type="button">
          주간 영상 출력 초기화
        </button>
      </div>
    </form>
    <p class="meta">
      광고 제거는 별도 1회 구매 상품입니다. Pro·Plus·Expert는 월 구독 플랜이며, 관리자가 월 플랜을 활성화하면 다른 월 플랜은 비활성 처리됩니다. 다운그레이드로 슬롯 한도를 넘긴 프로젝트는 삭제하지 않고 신규 업로드만 제한합니다.
    </p>
    <p id="subscriptionMessage" class="message"></p>
  `;
};

setupSubscriptionPanel();
renderSelectedPlanEntitlements("ad_remove");

const setAuthTab = (target) => {
  const isAdminTab = target === "admin";
  $("adminAuthTab").classList.toggle("active", isAdminTab);
  $("signupAuthTab").classList.toggle("active", !isAdminTab);
  $("adminAuthTab").setAttribute("aria-selected", String(isAdminTab));
  $("signupAuthTab").setAttribute("aria-selected", String(!isAdminTab));
  $("adminAuthPanel").classList.toggle("hidden", !isAdminTab);
  $("signupAuthPanel").classList.toggle("hidden", isAdminTab);
};

const adminTabPanelIds = {
  userSearch: "userSearchPanel",
  operationLinks: "operationLinksPanel",
  userDetail: "userDetailPanel",
  subscriptionManage: "subscriptionManagePanel",
  backupManage: "backupManagePanel"
};

const setAdminSectionTab = (tabListId, target) => {
  document.querySelectorAll(`#${tabListId} [data-admin-tab]`).forEach((button) => {
    const isActive = button.dataset.adminTab === target;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  const panelIds =
    tabListId === "leftAdminTabs"
      ? ["userSearchPanel", "operationLinksPanel"]
      : ["userDetailPanel", "subscriptionManagePanel", "backupManagePanel"];

  panelIds.forEach((panelId) => {
    $(panelId)?.classList.toggle("hidden", panelId !== adminTabPanelIds[target]);
  });
};

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.setAttribute("type", "button");
});

document.querySelectorAll("#leftAdminTabs [data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    setAdminSectionTab("leftAdminTabs", button.dataset.adminTab);
  });
});

document.querySelectorAll("#rightAdminTabs [data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    setAdminSectionTab("rightAdminTabs", button.dataset.adminTab);
  });
});

const setMessage = (id, message) => {
  $(id).textContent = message;
};

const getAuthErrorMessage = (error) => {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "이미 가입된 이메일입니다. 인증 메일이 필요하면 아래의 '인증 메일 다시 보내기'를 눌러 주세요.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/weak-password":
      return "비밀번호는 6자리 이상으로 입력해 주세요.";
    case "auth/operation-not-allowed":
      return "Firebase Authentication에서 이메일/비밀번호 로그인이 꺼져 있습니다. Firebase Console에서 사용 설정해 주세요.";
    case "auth/too-many-requests":
      return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/user-not-found":
      return "가입된 계정을 찾지 못했습니다.";
    case "permission-denied":
      return "Firestore 권한 문제로 정보를 처리하지 못했습니다. Firebase 규칙 배포 상태를 확인해 주세요.";
    default:
      return error?.message ?? "처리 중 문제가 발생했습니다.";
  }
};

const sendVerificationToCurrentUser = async (user) => {
  await sendEmailVerification(user, {
    url: window.location.origin,
    handleCodeInApp: false
  });
};

const parseDate = (value) => {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const toDateInput = (value) => {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getCurrentVideoExportWeek = (date = new Date()) => {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const kstDay = kstDate.getUTCDay();
  const daysFromMonday = (kstDay + 6) % 7;
  const weekStart = new Date(
    Date.UTC(
      kstDate.getUTCFullYear(),
      kstDate.getUTCMonth(),
      kstDate.getUTCDate() - daysFromMonday
    )
  );
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  const format = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  });

  return {
    weekId: weekStart.toISOString().slice(0, 10),
    weekLabel: `${format.format(weekStart)} - ${format.format(weekEnd)}`
  };
};

const isSubscriptionActive = (subscription) => {
  if (!subscription || subscription.plan !== "premium" || subscription.status !== "active") {
    return false;
  }

  const expiresAt = parseDate(subscription.expiresAt);
  return !expiresAt || expiresAt.getTime() > Date.now();
};

const isActiveProduct = (subscription, productId) =>
  isSubscriptionActive(subscription) && subscription.productId === productId;

const getAdminPlanTier = () => {
  if (
    isActiveProduct(currentProductSubscriptions.expert_monthly, "expert_monthly") ||
    isActiveProduct(currentSubscription, "expert_monthly")
  ) {
    return "expert";
  }

  if (
    isActiveProduct(currentProductSubscriptions.plus_monthly, "plus_monthly") ||
    isActiveProduct(currentSubscription, "plus_monthly")
  ) {
    return "plus";
  }

  if (
    isActiveProduct(currentProductSubscriptions.creator_monthly, "creator_monthly") ||
    isActiveProduct(currentSubscription, "creator_monthly")
  ) {
    return "pro";
  }

  if (
    isActiveProduct(currentProductSubscriptions.ad_remove, "ad_remove") ||
    isActiveProduct(currentSubscription, "ad_remove")
  ) {
    return "ad_remove";
  }

  return "free";
};

const getWeeklyVideoExportLimitForCurrentUser = () =>
  weeklyVideoExportLimits[getAdminPlanTier()] ?? weeklyVideoExportLimits.free;

const resolveProductSubscription = (productId, productSnap, current) => {
  if (productSnap.exists()) {
    return {
      productId,
      ...productSnap.data()
    };
  }

  const currentProductId =
    current?.productId === "premium" || (!current?.productId && current?.plan === "premium")
      ? "creator_monthly"
      : current?.productId;

  if (currentProductId === productId) {
    return {
      ...current,
      productId
    };
  }

  return null;
};

const getActiveProductIds = (subscriptions = currentProductSubscriptions) =>
  paidProductIds.filter((productId) => isSubscriptionActive(subscriptions[productId]));

const getEffectiveSubscription = (subscriptions = currentProductSubscriptions) => {
  if (isSubscriptionActive(subscriptions.expert_monthly)) {
    return subscriptions.expert_monthly;
  }

  if (isSubscriptionActive(subscriptions.plus_monthly)) {
    return subscriptions.plus_monthly;
  }

  if (isSubscriptionActive(subscriptions.creator_monthly)) {
    return subscriptions.creator_monthly;
  }

  if (isSubscriptionActive(subscriptions.ad_remove)) {
    return subscriptions.ad_remove;
  }

  return null;
};

const renderSubscriptionCards = () => {
  paidProductIds.forEach((productId) => {
    const meta = productMeta[productId];
    const subscription = currentProductSubscriptions[productId];
    const card = $(meta.cardId);
    const isActive = isSubscriptionActive(subscription);
    const status = subscription?.status ?? "inactive";
    const statusLabel = isActive ? "활성" : statusLabels[status] ?? status;
    const expiresText =
      productId !== "ad_remove" && subscription?.expiresAt
        ? `만료 ${formatDate(subscription.expiresAt)}`
        : productId === "ad_remove" && isActive
          ? "1회 결제 완료"
          : meta.description;

    card.classList.toggle("active", isActive);
    card.classList.toggle("expired", status === "expired");
    $(meta.statusId).textContent = statusLabel;
    $(meta.detailId).textContent = expiresText;
  });
};

const fillSubscriptionForm = (productId = $("productSelect").value) => {
  const subscription = currentProductSubscriptions[productId];
  $("productSelect").value = productId;
  $("productStatusSelect").value = subscription?.status ?? "inactive";
  $("productExpiresInput").value = toDateInput(subscription?.expiresAt);
  $("productExpiresInput").disabled = productId === "ad_remove";
  $("adminNoteInput").value = subscription?.adminNote ?? "";
};

const renderPlanPolicyValues = ({
  tier,
  localId,
  cloudProjectId,
  cloudPhotoId,
  videoId,
  visualId
}) => {
  const policy = getPlanPolicy(tier);
  if ($(localId)) $(localId).textContent = policy.localUsage;
  if ($(cloudProjectId)) {
    $(cloudProjectId).textContent = policy.maxCloudBackupProjects
      ? `최대 ${policy.maxCloudBackupProjects}개`
      : "사용 불가";
  }
  if ($(cloudPhotoId)) {
    $(cloudPhotoId).textContent = policy.maxCloudPhotosPerProject
      ? `최대 ${policy.maxCloudPhotosPerProject}장`
      : "-";
  }
  if ($(videoId)) {
    $(videoId).textContent = `주 ${policy.weeklyVideoExportLimit}회`;
  }
  if ($(visualId)) $(visualId).textContent = policy.visualPolicy;
};

const renderSelectedPlanEntitlements = (productId = $("productSelect").value) => {
  renderPlanPolicyValues({
    tier: productPlanTiers[productId] ?? "free",
    localId: "selectedLocalUsagePolicy",
    cloudProjectId: "selectedCloudProjectPolicy",
    cloudPhotoId: "selectedCloudPhotoPolicy",
    videoId: "selectedVideoExportPolicy",
    visualId: "selectedVisualPolicy"
  });
};

const renderCurrentPlanEntitlements = () => {
  const tier = getAdminPlanTier();
  $("effectivePlanLabel").textContent = adminPlanLabels[tier] ?? "무료";
  renderPlanPolicyValues({
    tier,
    localId: "localUsagePolicy",
    cloudProjectId: "cloudProjectPolicy",
    cloudPhotoId: "cloudPhotoPolicy",
    videoId: "videoExportPolicy",
    visualId: "visualPolicy"
  });
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const getDeleteAfter = (expiresAt) =>
  addMonths(expiresAt ? new Date(expiresAt) : new Date(), 3).toISOString();

const sortUsers = (users) =>
  [...users].sort((a, b) => {
    const aDate = parseDate(a.lastSignInAt) ?? parseDate(a.createdAt) ?? new Date(0);
    const bDate = parseDate(b.lastSignInAt) ?? parseDate(b.createdAt) ?? new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

const showAdmin = (enabled) => {
  authLoadingPanel.classList.add("hidden");
  loginPanel.classList.toggle("hidden", enabled);
  adminPanel.classList.toggle("hidden", !enabled);
  $("signOutButton").classList.toggle("hidden", !enabled);
};

const resetBackupManager = () => {
  backupItemsByTab = {
    image: [],
    video: [],
    music: []
  };
  backupPagesByTab = {
    image: 1,
    video: 1,
    music: 1
  };
  loadedBackupTabs = {
    image: false,
    video: false,
    music: false
  };
  if ($("backupItemList")) {
    $("backupItemList").innerHTML = "";
    $("backupItemsPageInfo").textContent = "-";
    $("backupUploadInput").value = "";
    setMessage("backupItemsMessage", "사용자를 선택한 뒤 탭을 클릭해 백업 데이터를 불러오세요.");
  }
};

const resetWeeklyVideoUsageSummary = () => {
  if (!$("weeklyVideoRemaining")) return;
  $("weeklyVideoRemaining").textContent = "-";
  $("weeklyVideoUsageDetail").textContent = "사용량을 불러오면 표시됩니다.";
  $("weeklyVideoUsageMeta").textContent = "-";
  $("weeklyVideoUsageFill").style.width = "0%";
  $("weeklyVideoUsageCard")?.classList.remove("usage-warning");
};

const renderWeeklyVideoExportUsage = async () => {
  if (!currentUserDoc) {
    resetWeeklyVideoUsageSummary();
    return;
  }

  const { weekId, weekLabel } = getCurrentVideoExportWeek();
  const planTier = getAdminPlanTier();
  const limit = getWeeklyVideoExportLimitForCurrentUser();

  try {
    const snapshot = await getDoc(
      doc(db, "users", currentUserDoc.id, "usage", "videoExports", "weeks", weekId)
    );
    const count = snapshot.exists()
      ? Math.max(0, Number(snapshot.data().count ?? 0))
      : 0;
    const remaining = Math.max(0, limit - count);
    const usagePercent = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;

    $("weeklyVideoRemaining").textContent = `${remaining}개 남음`;
    $("weeklyVideoUsageDetail").textContent = `${count}개 사용 / 주 ${limit}개 한도`;
    $("weeklyVideoUsageMeta").textContent = `${adminPlanLabels[planTier]} · ${weekLabel}`;
    $("weeklyVideoUsageFill").style.width = `${usagePercent}%`;
    $("weeklyVideoUsageCard")?.classList.toggle("usage-warning", limit > 0 && remaining <= 0);
  } catch (error) {
    $("weeklyVideoRemaining").textContent = "-";
    $("weeklyVideoUsageDetail").textContent =
      error?.message ?? "주간 영상 출력 사용량을 불러오지 못했습니다.";
    $("weeklyVideoUsageMeta").textContent = `${adminPlanLabels[planTier]} · ${weekLabel}`;
    $("weeklyVideoUsageFill").style.width = "0%";
    $("weeklyVideoUsageCard")?.classList.remove("usage-warning");
  }
};

const setSelectedUserPanelsVisible = (hasSelectedUser) => {
  $("userEmptyPanel")?.classList.toggle("hidden", hasSelectedUser);
  $("subscriptionEmptyPanel")?.classList.toggle("hidden", hasSelectedUser);
  $("backupEmptyPanel")?.classList.toggle("hidden", hasSelectedUser);
  userPanel.classList.toggle("hidden", !hasSelectedUser);
  subscriptionPanel.classList.toggle("hidden", !hasSelectedUser);
  backupPanel.classList.toggle("hidden", !hasSelectedUser);
};

const resetUserPanels = () => {
  currentUserDoc = null;
  currentSubscription = null;
  currentProductSubscriptions = {
    ad_remove: null,
    creator_monthly: null,
    plus_monthly: null,
    expert_monthly: null
  };
  currentBackup = null;
  currentBackupProjectSlots = [];
  currentBodyProjects = [];
  currentProjectBackupStats = {};
  setSelectedUserPanelsVisible(false);
  resetWeeklyVideoUsageSummary();
  $("statPlan").textContent = "-";
  $("statBackups").textContent = "-";
  $("statStatus").textContent = "-";
  resetBackupManager();
};

const requireAdmin = async (user) => {
  if (!user) return false;
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  return adminSnap.exists();
};

const getUserSearchText = (user) =>
  [user.email, user.displayName, user.id].filter(Boolean).join(" ").toLowerCase();

const findLoadedUserBySearchTerm = (term) => {
  const keyword = term.toLowerCase();
  return (
    allUsers.find((user) =>
      [user.email, user.displayName, user.id].some(
        (value) => value?.toLowerCase() === keyword
      )
    ) ?? allUsers.find((user) => getUserSearchText(user).includes(keyword))
  );
};

const renderUserList = () => {
  const keyword = $("userFilterInput").value.trim().toLowerCase();
  const filtered = allUsers.filter((user) => {
    return getUserSearchText(user).includes(keyword);
  });
  const userList = $("userList");
  userList.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(filtered.length / usersPageSize));
  usersPage = Math.min(Math.max(usersPage, 1), totalPages);
  const start = (usersPage - 1) * usersPageSize;
  const pageUsers = filtered.slice(start, start + usersPageSize);

  if (!filtered.length) {
    userList.innerHTML = '<div class="empty">표시할 사용자가 없습니다.</div>';
    $("statUsers").textContent = String(allUsers.length);
    $("usersPageInfo").textContent = "0 / 0";
    $("prevUsersPageButton").disabled = true;
    $("nextUsersPageButton").disabled = true;
    return;
  }

  pageUsers.forEach((user) => {
    const button = document.createElement("button");
    button.type = "button";
    const selected = currentUserDoc?.id === user.id;
    button.className = `user-row ${selected ? "active" : ""}`;
    button.dataset.userId = user.id;
    button.setAttribute("aria-pressed", String(selected));

    const title = document.createElement("strong");
    title.textContent = user.email || user.displayName || "이메일 없음";

    const detail = document.createElement("span");
    detail.className = "meta";
    detail.textContent = `${user.displayName || "이름 없음"} · ${formatDate(user.lastSignInAt || user.createdAt)}`;

    const uid = document.createElement("span");
    uid.className = "uid";
    uid.textContent = user.id;

    button.append(title, detail, uid);
    button.addEventListener("click", async () => {
      currentUserDoc = user;
      setMessage("userListMessage", "사용자 정보를 불러오는 중입니다.");
      await loadUserDetail();
      renderUserList();
      setMessage("userListMessage", "선택한 사용자를 불러왔습니다.");
    });
    userList.appendChild(button);
  });

  $("statUsers").textContent = String(allUsers.length);
  $("usersPageInfo").textContent = `${usersPage} / ${totalPages} · ${start + 1}-${Math.min(
    start + usersPageSize,
    filtered.length
  )}명 표시`;
  $("prevUsersPageButton").disabled = usersPage <= 1;
  $("nextUsersPageButton").disabled = usersPage >= totalPages;
};

const loadUsers = async () => {
  setMessage("userListMessage", "사용자 목록을 불러오는 중입니다.");
  try {
    const snapshot = await getDocs(collection(db, "users"));
    allUsers = sortUsers(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }))
    );
    renderUserList();
    setMessage(
      "userListMessage",
      allUsers.length ? `${allUsers.length}명의 사용자를 불러왔습니다.` : "아직 가입한 사용자가 없습니다."
    );
  } catch (error) {
    setMessage("userListMessage", error?.message ?? "사용자 목록을 불러오지 못했습니다.");
  }
};

const sortBackupItems = (items) =>
  [...items].sort((a, b) => {
    const aDate = parseDate(a.date) ?? new Date(0);
    const bDate = parseDate(b.date) ?? new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

const toPhotoBackupItem = (docSnapshot) => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    itemType: "photo",
    tab: "image",
    title: data.name || data.title || data.localId || docSnapshot.id,
    detail: `사진 · ${formatBytes(data.imageBackupSize ?? data.optimizedSize ?? data.fileSize)} · ${formatDate(
      data.backedUpAt || data.lastBackedUpAt || data.backupEnabledAt
    )}`,
    date: data.backedUpAt || data.lastBackedUpAt || data.backupEnabledAt,
    url: data.downloadURL || data.uri || data.previewUri,
    storagePath: data.storagePath ?? "-",
    projectId: data.projectId ?? null
  };
};

const toImageWorkBackupItem = (docSnapshot) => {
  const data = docSnapshot.data();
  const imageCount = Array.isArray(data.imageUris) ? data.imageUris.length : 0;
  return {
    id: docSnapshot.id,
    itemType: "imageWork",
    tab: "image",
    title: data.title || data.localId || docSnapshot.id,
    detail: `이미지 작업 ${imageCount}장 · ${formatBytes(data.imageBackupSize ?? data.fileSize)} · ${formatDate(
      data.backedUpAt || data.lastBackedUpAt || data.backupEnabledAt
    )}`,
    date: data.backedUpAt || data.lastBackedUpAt || data.backupEnabledAt,
    url: Array.isArray(data.imageUris) ? data.imageUris[0] : null,
    storagePath: Array.isArray(data.storagePaths) ? data.storagePaths[0] ?? "-" : "-",
    projectId: data.projectId ?? null
  };
};

const toVideoBackupItem = (docSnapshot) => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    itemType: "video",
    tab: "video",
    title: data.title || data.localId || docSnapshot.id,
    detail: `동영상 · ${formatBytes(data.fileSize)} · ${formatDate(
      data.backedUpAt || data.lastBackedUpAt || data.createdAt
    )}`,
    date: data.backedUpAt || data.lastBackedUpAt || data.createdAt,
    url: data.downloadURL || data.uri,
    storagePath: data.storagePath ?? "-",
    projectId: data.projectId ?? null
  };
};

const toMusicBackupItem = (docSnapshot) => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    itemType: "music",
    tab: "music",
    title: data.name || docSnapshot.id,
    detail: `음악 · ${formatBytes(data.size)} · ${formatDate(data.createdAt || data.updatedAt)}`,
    date: data.createdAt || data.updatedAt,
    url: data.downloadUrl,
    storagePath: data.storagePath ?? "-",
    projectId: null
  };
};

const getBodyProjectName = (projectId) =>
  currentBodyProjects.find((project) => project.id === projectId)?.name ||
  projectId ||
  "프로젝트 정보 없음";

const getProjectBackupStats = (projectId) =>
  currentProjectBackupStats[projectId] ?? { photoCount: 0, videoCount: 0 };

const getUsableBackupProjectSlots = () => {
  const policy = getPlanPolicy(getAdminPlanTier());
  return currentBackupProjectSlots.filter(
    (slot) => slot.slotNumber >= 1 && slot.slotNumber <= policy.maxCloudBackupProjects
  );
};

const renderBackupProjectSelects = () => {
  const filterSelect = $("backupProjectFilterSelect");
  const uploadSelect = $("backupUploadProjectSelect");
  if (!filterSelect || !uploadSelect) return;

  const previousFilter = filterSelect.value || "all";
  const previousUpload = uploadSelect.value;
  const projectIds = new Set([
    ...currentBackupProjectSlots.map((slot) => slot.projectId),
    ...Object.keys(currentProjectBackupStats),
    ...currentBodyProjects.map((project) => project.id)
  ]);

  filterSelect.innerHTML = '<option value="all">전체 프로젝트</option>';
  for (const projectId of projectIds) {
    if (!projectId) continue;
    const option = document.createElement("option");
    option.value = projectId;
    option.textContent = getBodyProjectName(projectId);
    filterSelect.appendChild(option);
  }
  if ([...filterSelect.options].some((option) => option.value === previousFilter)) {
    filterSelect.value = previousFilter;
  }

  uploadSelect.innerHTML = '<option value="">프로젝트 선택</option>';
  for (const slot of getUsableBackupProjectSlots()) {
    const option = document.createElement("option");
    option.value = slot.projectId;
    option.textContent = `슬롯 ${slot.slotNumber} · ${getBodyProjectName(slot.projectId)}`;
    uploadSelect.appendChild(option);
  }
  if ([...uploadSelect.options].some((option) => option.value === previousUpload)) {
    uploadSelect.value = previousUpload;
  }
};

const replaceBackupProjectSlot = async (slot) => {
  if (!currentUserDoc) return;

  const projectId = window.prompt(
    `슬롯 ${slot.slotNumber}에 연결할 새 프로젝트 ID를 입력해 주세요.\n현재 프로젝트: ${getBodyProjectName(slot.projectId)}`,
    ""
  )?.trim();
  if (!projectId || projectId === slot.projectId) return;

  const confirmed = window.confirm(
    "백업 프로젝트를 변경하면 현재 프로젝트의 클라우드 사진과 연결된 클라우드 영상이 모두 삭제됩니다. 로컬 기기의 프로젝트와 원본 사진은 삭제되지 않으며, 새 프로젝트는 처음부터 다시 업로드해야 합니다. 계속할까요?"
  );
  if (!confirmed) return;

  setMessage("backupMessage", "기존 클라우드 데이터를 삭제하고 프로젝트 슬롯을 변경하는 중입니다.");
  try {
    const result = await replaceAdminCloudBackupProject({
      targetUid: currentUserDoc.id,
      slotId: slot.id,
      projectId
    });
    const deletedPhotoCount = Number(result.data?.deletedPhotoCount ?? 0);
    const deletedVideoCount = Number(result.data?.deletedVideoCount ?? 0);
    await loadUserDetail();
    setMessage(
      "backupMessage",
      `프로젝트 슬롯을 변경했습니다. 기존 사진 ${deletedPhotoCount}개, 영상 ${deletedVideoCount}개를 삭제했습니다.`
    );
  } catch (error) {
    setMessage("backupMessage", error?.message ?? "프로젝트 슬롯 변경 중 문제가 발생했습니다.");
  }
};

const renderBackupProjectSlots = () => {
  const list = $("backupProjectSlotList");
  if (!list) return;

  const tier = getAdminPlanTier();
  const policy = getPlanPolicy(tier);
  const usableSlots = getUsableBackupProjectSlots();
  const overLimitCount = currentBackupProjectSlots.filter(
    (slot) => slot.slotNumber > policy.maxCloudBackupProjects
  ).length;

  $("cloudSlotUsage").textContent = policy.maxCloudBackupProjects
    ? `${usableSlots.length} / ${policy.maxCloudBackupProjects} 슬롯 사용`
    : "클라우드 미지원";
  $("cloudPlanPolicy").textContent = policy.maxCloudBackupProjects
    ? `${adminPlanLabels[tier]} · 프로젝트 최대 ${policy.maxCloudBackupProjects}개 · 프로젝트당 사진 최대 ${policy.maxCloudPhotosPerProject}장${overLimitCount ? ` · 플랜 초과 슬롯 ${overLimitCount}개` : ""}`
    : `${adminPlanLabels[tier]} 플랜은 클라우드 프로젝트 백업을 지원하지 않습니다.`;

  list.innerHTML = "";
  const slotMap = new Map(
    currentBackupProjectSlots.map((slot) => [slot.slotNumber, slot])
  );
  const maxVisibleSlot = Math.max(
    policy.maxCloudBackupProjects,
    ...currentBackupProjectSlots.map((slot) => slot.slotNumber),
    0
  );

  if (maxVisibleSlot === 0) {
    list.innerHTML =
      '<div class="empty">선택된 클라우드 백업 프로젝트가 없습니다.</div>';
    renderBackupProjectSelects();
    return;
  }

  for (let slotNumber = 1; slotNumber <= maxVisibleSlot; slotNumber += 1) {
    const slot = slotMap.get(slotNumber);
    const row = document.createElement("div");
    row.className = "backup-project-slot";

    const copy = document.createElement("div");
    copy.className = "backup-project-slot-copy";
    const label = document.createElement("span");
    label.className = "meta";
    label.textContent = `슬롯 ${slotNumber}`;
    const title = document.createElement("strong");

    if (!slot) {
      title.textContent = "비어 있음";
      const detail = document.createElement("span");
      detail.className = "meta";
      detail.textContent = `사진 0 / ${policy.maxCloudPhotosPerProject || 365}`;
      copy.append(label, title, detail);
      row.append(copy);
      list.appendChild(row);
      continue;
    }

    const stats = getProjectBackupStats(slot.projectId);
    const overLimit = slotNumber > policy.maxCloudBackupProjects;
    const photoFull =
      policy.maxCloudPhotosPerProject > 0 &&
      stats.photoCount >= policy.maxCloudPhotosPerProject;
    const status = document.createElement("span");
    status.className = `slot-status ${overLimit ? "over-limit" : photoFull ? "full" : ""}`;
    status.textContent = overLimit
      ? "플랜 초과"
      : photoFull
        ? "사진 한도 도달"
        : "사용 중";

    title.textContent = getBodyProjectName(slot.projectId);
    const counts = document.createElement("span");
    counts.className = "meta";
    counts.textContent = `사진 ${stats.photoCount} / ${policy.maxCloudPhotosPerProject || 365} · 영상 ${stats.videoCount}개 · ${status.textContent}`;
    const projectId = document.createElement("span");
    projectId.className = "uid";
    projectId.textContent = slot.projectId;
    const selectedAt = document.createElement("span");
    selectedAt.className = "meta";
    selectedAt.textContent = `선택일 ${formatDate(slot.selectedAt)}`;
    copy.append(label, title, counts, projectId, selectedAt);

    const actions = document.createElement("div");
    actions.className = "backup-project-slot-actions";
    if (!overLimit) {
      const replaceButton = document.createElement("button");
      replaceButton.type = "button";
      replaceButton.className = "secondary";
      replaceButton.textContent = "프로젝트 변경";
      replaceButton.addEventListener("click", () => replaceBackupProjectSlot(slot));
      actions.appendChild(replaceButton);
    }

    row.append(copy, actions);
    list.appendChild(row);
  }

  renderBackupProjectSelects();
};

const renderBackupTabs = () => {
  backupTabs.forEach((tab) => {
    const button = document.querySelector(`[data-backup-tab="${tab}"]`);
    button?.classList.toggle("active", activeBackupTab === tab);
    button?.setAttribute("aria-selected", String(activeBackupTab === tab));
  });
  $("backupUploadInput").accept = backupUploadAccept[activeBackupTab] ?? "";
  const needsProject = activeBackupTab === "image" || activeBackupTab === "video";
  $("backupUploadProjectField")?.classList.toggle("hidden", !needsProject);
  if ($("backupUploadButton")) {
    $("backupUploadButton").disabled =
      needsProject && getUsableBackupProjectSlots().length === 0;
  }
};

const renderBackupItems = () => {
  renderBackupTabs();
  const allItems = backupItemsByTab[activeBackupTab] ?? [];
  const selectedProjectId = $("backupProjectFilterSelect")?.value ?? "all";
  const items =
    selectedProjectId === "all"
      ? allItems
      : allItems.filter((item) => item.projectId === selectedProjectId);
  const totalPages = Math.max(1, Math.ceil(items.length / backupPageSize));
  backupPagesByTab[activeBackupTab] = Math.min(
    Math.max(backupPagesByTab[activeBackupTab], 1),
    totalPages
  );
  const page = backupPagesByTab[activeBackupTab];
  const start = (page - 1) * backupPageSize;
  const pageItems = items.slice(start, start + backupPageSize);
  const list = $("backupItemList");
  list.innerHTML = "";

  if (!currentUserDoc) {
    list.innerHTML = '<div class="empty">사용자를 먼저 선택하세요.</div>';
    $("backupItemsPageInfo").textContent = "-";
    $("prevBackupItemsPageButton").disabled = true;
    $("nextBackupItemsPageButton").disabled = true;
    return;
  }

  if (!loadedBackupTabs[activeBackupTab]) {
    list.innerHTML = '<div class="empty">탭을 클릭하면 백업 데이터를 불러옵니다.</div>';
    $("backupItemsPageInfo").textContent = "-";
    $("prevBackupItemsPageButton").disabled = true;
    $("nextBackupItemsPageButton").disabled = true;
    return;
  }

  if (!items.length) {
    list.innerHTML = '<div class="empty">표시할 백업 데이터가 없습니다.</div>';
    $("backupItemsPageInfo").textContent = "0 / 0";
    $("prevBackupItemsPageButton").disabled = true;
    $("nextBackupItemsPageButton").disabled = true;
    return;
  }

  pageItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "backup-item";

    const copy = document.createElement("div");
    copy.className = "backup-item-copy";
    const title = document.createElement("strong");
    title.className = "backup-item-title";
    title.textContent = item.title;
    title.title = item.title;
    const detail = document.createElement("span");
    detail.className = "meta";
    detail.textContent = item.projectId
      ? `${item.detail} · ${getBodyProjectName(item.projectId)}`
      : item.detail;
    const path = document.createElement("span");
    path.className = "uid";
    path.textContent = item.storagePath;
    path.title = item.storagePath;
    copy.append(title, detail, path);

    const actions = document.createElement("div");
    actions.className = "backup-item-actions";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "secondary";
    openButton.textContent = "확인";
    openButton.addEventListener("click", () => openBackupItem(item));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "제거";
    deleteButton.addEventListener("click", () => removeBackupItem(item));
    actions.append(openButton, deleteButton);

    row.append(copy, actions);
    list.appendChild(row);
  });

  $("backupItemsPageInfo").textContent = `${page} / ${totalPages} · ${start + 1}-${Math.min(
    start + backupPageSize,
    items.length
  )}개 표시`;
  $("prevBackupItemsPageButton").disabled = page <= 1;
  $("nextBackupItemsPageButton").disabled = page >= totalPages;
};

const loadBackupItems = async (tab = activeBackupTab) => {
  if (!currentUserDoc) return;
  activeBackupTab = tab;
  backupPagesByTab[tab] = 1;
  renderBackupItems();
  setMessage("backupItemsMessage", `${backupTabLabels[tab]} 백업 데이터를 불러오는 중입니다.`);

  try {
    if (tab === "image") {
      const [photoSnapshot, imageWorkSnapshot] = await Promise.all([
        getDocs(collection(db, "users", currentUserDoc.id, "photoBackups")),
        getDocs(collection(db, "users", currentUserDoc.id, "imageWorks"))
      ]);
      backupItemsByTab.image = sortBackupItems([
        ...photoSnapshot.docs.map(toPhotoBackupItem),
        ...imageWorkSnapshot.docs.map(toImageWorkBackupItem)
      ]);
    } else if (tab === "video") {
      const snapshot = await getDocs(collection(db, "users", currentUserDoc.id, "videos"));
      backupItemsByTab.video = sortBackupItems(snapshot.docs.map(toVideoBackupItem));
    } else {
      const snapshot = await getDocs(collection(db, "users", currentUserDoc.id, "musicTracks"));
      backupItemsByTab.music = sortBackupItems(snapshot.docs.map(toMusicBackupItem));
    }

    loadedBackupTabs[tab] = true;
    renderBackupItems();
    setMessage(
      "backupItemsMessage",
      `${backupItemsByTab[tab].length}개의 ${backupTabLabels[tab]} 백업 데이터를 불러왔습니다.`
    );
  } catch (error) {
    setMessage("backupItemsMessage", error?.message ?? "백업 데이터를 불러오지 못했습니다.");
  }
};

const openBackupItem = (item) => {
  const privateFile = item.url && item.url.startsWith("https://firebasestorage.googleapis.com/") &&
    !new URL(item.url).searchParams.has("token");
  const lines = [
    `종류: ${backupTabLabels[item.tab]}`,
    `ID: ${item.id}`,
    `Storage: ${item.storagePath}`
  ];
  if (privateFile) {
    lines.push("비공개 파일: 소유 계정의 앱에서 확인할 수 있습니다. 관리자 페이지에서는 미리보기를 제공하지 않습니다.");
  } else if (item.url) {
    window.open(item.url, "_blank", "noreferrer");
  }
  setMessage("backupItemsMessage", lines.join(" / "));
};

const removeBackupItem = async (item) => {
  if (!currentUserDoc) return;
  const confirmed = window.confirm(`${item.title} 백업 데이터를 제거할까요? Storage 파일과 문서가 함께 삭제됩니다.`);
  if (!confirmed) return;

  setMessage("backupItemsMessage", "백업 데이터를 제거하는 중입니다.");
  try {
    await deleteAdminBackupItem({
      targetUid: currentUserDoc.id,
      itemType: item.itemType,
      itemId: item.id
    });
    loadedBackupTabs[activeBackupTab] = false;
    await loadBackupItems(activeBackupTab);
    await loadUserDetail({ preserveBackupItems: true });
    setMessage("backupItemsMessage", "백업 데이터를 제거했습니다.");
  } catch (error) {
    setMessage("backupItemsMessage", error?.message ?? "백업 데이터 제거 중 문제가 발생했습니다.");
  }
};

const uploadAdminBackupFile = async (file) => {
  if (!currentUserDoc || !file) return;

  const tab = activeBackupTab;
  const projectId =
    tab === "image" || tab === "video"
      ? $("backupUploadProjectSelect")?.value?.trim()
      : null;
  if ((tab === "image" || tab === "video") && !projectId) {
    setMessage("backupItemsMessage", "업로드할 클라우드 백업 프로젝트를 선택해 주세요.");
    $("backupUploadInput").value = "";
    return;
  }

  setMessage("backupItemsMessage", `${backupTabLabels[tab]} 파일 업로드를 준비하는 중입니다.`);
  try {
    const reservation = await reserveAdminBackupUpload({
      targetUid: currentUserDoc.id,
      projectId,
      itemKind: tab,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type
    });
    const { uploadSessionId, storagePath } = reservation.data;
    const uploadRef = ref(storage, storagePath);
    const task = uploadBytesResumable(uploadRef, file, {
      contentType: file.type,
      customMetadata: {
        adminBackupSessionId: uploadSessionId
      }
    });

    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100);
          setMessage("backupItemsMessage", `${backupTabLabels[tab]} 파일 업로드 중입니다. ${percent}%`);
        },
        reject,
        resolve
      );
    });

    const downloadUrl = await getDownloadURL(task.snapshot.ref);
    await completeAdminBackupUpload({
      targetUid: currentUserDoc.id,
      uploadSessionId,
      downloadUrl
    });
    $("backupUploadInput").value = "";
    loadedBackupTabs[tab] = false;
    await loadBackupItems(tab);
    await loadUserDetail({ preserveBackupItems: true });
    setMessage("backupItemsMessage", "백업 파일을 업로드했습니다.");
  } catch (error) {
    setMessage("backupItemsMessage", error?.message ?? "백업 파일 업로드 중 문제가 발생했습니다.");
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdmin = null;
    allUsers = [];
    showAdmin(false);
    resetUserPanels();
    $("statUsers").textContent = "0";
    return;
  }

  if (isCreatingRegularAccount) {
    return;
  }

  const isAdmin = await requireAdmin(user);
  if (!isAdmin) {
    setMessage("loginMessage", "관리자 권한이 없습니다. Firestore의 admins/{uid} 문서를 확인해 주세요.");
    await signOut(auth);
    return;
  }

  currentAdmin = user;
  setMessage("loginMessage", "");
  showAdmin(true);
  await loadUsers();
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("loginMessage", "");
  try {
    await signInWithEmailAndPassword(
      auth,
      $("emailInput").value.trim(),
      $("passwordInput").value
    );
  } catch (error) {
    setMessage("loginMessage", getAuthErrorMessage(error));
  }
});

$("signOutButton").addEventListener("click", () => signOut(auth));
$("adminAuthTab").addEventListener("click", () => setAuthTab("admin"));
$("signupAuthTab").addEventListener("click", () => setAuthTab("signup"));
$("refreshUsersButton").addEventListener("click", loadUsers);
$("userFilterInput").addEventListener("input", () => {
  usersPage = 1;
  renderUserList();
});
$("prevUsersPageButton").addEventListener("click", () => {
  usersPage -= 1;
  renderUserList();
});
$("nextUsersPageButton").addEventListener("click", () => {
  usersPage += 1;
  renderUserList();
});

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("signupMessage", "회원가입을 처리하고 있습니다.");
  isCreatingRegularAccount = true;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      $("signupEmailInput").value.trim(),
      $("signupPasswordInput").value
    );
    const user = credential.user;

    await sendVerificationToCurrentUser(user);
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName ?? null,
      emailVerified: user.emailVerified,
      providerIds: user.providerData.map((provider) => provider.providerId),
      createdAt: new Date().toISOString(),
      lastSignInAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await signOut(auth);
    $("signupForm").reset();
    setMessage(
      "signupMessage",
      "일반 회원가입이 완료되었습니다. 입력한 이메일로 발송된 인증 메일을 확인해 주세요."
    );
  } catch (error) {
    setMessage("signupMessage", getAuthErrorMessage(error));
  } finally {
    if (auth.currentUser && !currentAdmin) {
      await signOut(auth);
    }
    isCreatingRegularAccount = false;
  }
});

$("resendVerificationButton").addEventListener("click", async () => {
  const email = $("signupEmailInput").value.trim();
  const password = $("signupPasswordInput").value;

  if (!email || !password) {
    setMessage("signupMessage", "이메일과 비밀번호를 입력한 뒤 다시 시도해 주세요.");
    return;
  }

  setMessage("signupMessage", "인증 메일을 다시 보내고 있습니다.");
  isCreatingRegularAccount = true;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (credential.user.emailVerified) {
      setMessage("signupMessage", "이미 이메일 인증이 완료된 계정입니다.");
    } else {
      await sendVerificationToCurrentUser(credential.user);
      setMessage("signupMessage", "인증 메일을 다시 보냈습니다. 메일함과 스팸함을 확인해 주세요.");
    }
  } catch (error) {
    setMessage("signupMessage", getAuthErrorMessage(error));
  } finally {
    await signOut(auth);
    isCreatingRegularAccount = false;
  }
});

$("searchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const term = $("searchInput").value.trim();
  if (!term) return;

  setMessage("searchMessage", "검색 중입니다.");
  resetUserPanels();

  try {
    const loadedUser = findLoadedUserBySearchTerm(term);
    let userSnap = null;

    if (!loadedUser) {
      userSnap = await getDoc(doc(db, "users", term));
      if (!userSnap.exists()) {
        const foundByEmail = await getDocs(
          query(collection(db, "users"), where("email", "==", term), limit(1))
        );
        userSnap = foundByEmail.docs[0] ?? null;
      }

      if (!userSnap?.exists()) {
        const foundByName = await getDocs(
          query(collection(db, "users"), where("displayName", "==", term), limit(1))
        );
        userSnap = foundByName.docs[0] ?? null;
      }
    }

    if (!loadedUser && !userSnap?.exists()) {
      setMessage("searchMessage", "사용자를 찾지 못했습니다.");
      renderUserList();
      return;
    }

    currentUserDoc = loadedUser ?? {
      id: userSnap.id,
      ...userSnap.data()
    };
    if (!allUsers.some((user) => user.id === currentUserDoc.id)) {
      allUsers = sortUsers([...allUsers, currentUserDoc]);
    }
    await loadUserDetail();
    renderUserList();
    setMessage("searchMessage", "사용자 정보를 불러왔습니다.");
  } catch (error) {
    setMessage("searchMessage", error?.message ?? "사용자 검색 중 문제가 발생했습니다.");
  }
});

const loadUserDetail = async ({ preserveBackupItems = false } = {}) => {
  if (!currentUserDoc) return;
  if (!preserveBackupItems) {
    resetBackupManager();
  }

  const uid = currentUserDoc.id;
  const [
    subscriptionSnap,
    adRemoveSnap,
    creatorMonthlySnap,
    plusMonthlySnap,
    expertMonthlySnap,
    backupSnap,
    photoBackups,
    musicTracks,
    videos,
    backupProjectSlots,
    bodyProjects
  ] = await Promise.all([
    getDoc(doc(db, "users", uid, "subscriptions", "current")),
    getDoc(doc(db, "users", uid, "subscriptions", "ad_remove")),
    getDoc(doc(db, "users", uid, "subscriptions", "creator_monthly")),
    getDoc(doc(db, "users", uid, "subscriptions", "plus_monthly")),
    getDoc(doc(db, "users", uid, "subscriptions", "expert_monthly")),
    getDoc(doc(db, "users", uid, "backups", "current")),
    getDocs(collection(db, "users", uid, "photoBackups")),
    getDocs(collection(db, "users", uid, "musicTracks")),
    getDocs(collection(db, "users", uid, "videos")),
    getDocs(collection(db, "users", uid, "backupProjectSlots")),
    getDocs(collection(db, "users", uid, "bodyProjects"))
  ]);

  currentSubscription = subscriptionSnap.exists() ? subscriptionSnap.data() : null;
  currentProductSubscriptions = {
    ad_remove: resolveProductSubscription("ad_remove", adRemoveSnap, currentSubscription),
    creator_monthly: resolveProductSubscription(
      "creator_monthly",
      creatorMonthlySnap,
      currentSubscription
    ),
    plus_monthly: resolveProductSubscription(
      "plus_monthly",
      plusMonthlySnap,
      currentSubscription
    ),
    expert_monthly: resolveProductSubscription(
      "expert_monthly",
      expertMonthlySnap,
      currentSubscription
    )
  };
  currentBackup = backupSnap.exists() ? backupSnap.data() : null;
  currentBackupProjectSlots = backupProjectSlots.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        slotNumber: Math.max(1, Number(data.slotNumber ?? item.id.replace("slot-", "")) || 1),
        projectId: String(data.projectId ?? ""),
        status: data.status === "over_limit" ? "over_limit" : "active",
        selectedAt: data.selectedAt ?? null,
        updatedAt: data.updatedAt ?? null
      };
    })
    .filter((slot) => slot.projectId)
    .sort((a, b) => a.slotNumber - b.slotNumber);
  currentBodyProjects = bodyProjects.docs.map((item) => ({
    id: item.id,
    name: item.data().name || item.data().title || item.id
  }));
  currentProjectBackupStats = {};
  const rememberProjectItem = (snapshot, key) => {
    snapshot.docs.forEach((item) => {
      const projectId = item.data().projectId;
      if (!projectId) return;
      currentProjectBackupStats[projectId] ??= { photoCount: 0, videoCount: 0 };
      currentProjectBackupStats[projectId][key] += 1;
    });
  };
  rememberProjectItem(photoBackups, "photoCount");
  rememberProjectItem(videos, "videoCount");

  $("userUid").textContent = uid;
  $("userEmail").textContent = currentUserDoc.email ?? "-";
  $("userName").textContent = currentUserDoc.displayName ?? "-";
  $("userLastSignIn").textContent = formatDate(currentUserDoc.lastSignInAt);

  const activeProductIds = getActiveProductIds();
  const effectiveTier = getAdminPlanTier();
  $("statPlan").textContent = adminPlanLabels[effectiveTier] ?? "무료";
  const imageBundleCount = currentBackup?.imageBundleCount ?? 0;
  const videoCount = currentBackup?.videoCount ?? 0;
  const musicCount = currentBackup?.musicCount ?? musicTracks.size;
  $("statBackups").textContent = String(photoBackups.size + imageBundleCount + videoCount + musicCount);
  $("statStatus").textContent = activeProductIds.length
    ? `${activeProductIds.length}개 활성`
    : "비활성";

  renderSubscriptionCards();
  renderCurrentPlanEntitlements();
  fillSubscriptionForm($("productSelect").value || "ad_remove");
  renderSelectedPlanEntitlements($("productSelect").value || "ad_remove");
  renderBackupProjectSlots();

  $("backupStatus").textContent = currentBackup?.status ?? "없음";
  $("backupDeleteAfter").textContent = formatDate(currentBackup?.deleteAfter);
  $("backupCounts").textContent = `사진 ${photoBackups.size}개 / 작업 ${imageBundleCount}개 / 동영상 ${videoCount}개 / 음악 ${musicCount}개`;

  await renderWeeklyVideoExportUsage();
  setSelectedUserPanelsVisible(true);
};

const saveProductSubscription = async (event) => {
  event.preventDefault();

  if (!currentAdmin || !currentUserDoc) return;

  setMessage("subscriptionMessage", "저장 중입니다.");

  const productId = $("productSelect").value;
  const selectedStatus = $("productStatusSelect").value;
  const expiresValue = $("productExpiresInput").value;
  const expiresAt = expiresValue ? new Date(`${expiresValue}T23:59:59`).toISOString() : null;

  try {
    await setAdminProductSubscription({
      targetUid: currentUserDoc.id,
      productId,
      status: selectedStatus,
      expiresAt: productId === "ad_remove" ? null : expiresAt,
      adminNote: $("adminNoteInput").value.trim() || null
    });

    setMessage("subscriptionMessage", "상품 상태를 저장했습니다.");
    await loadUserDetail();
  } catch (error) {
    setMessage("subscriptionMessage", error?.message ?? "상품 상태 저장 중 문제가 발생했습니다.");
  }
};

const resetWeeklyVideoExport = async () => {
  if (!currentUserDoc) {
    setMessage("subscriptionMessage", "사용자를 먼저 선택해 주세요.");
    return;
  }

  const { weekId, weekLabel } = getCurrentVideoExportWeek();
  const confirmed = window.confirm(`${weekLabel} 주간 영상 출력 횟수를 초기화할까요?`);
  if (!confirmed) return;

  setMessage("subscriptionMessage", "주간 영상 출력 횟수를 초기화하는 중입니다.");

  try {
    await deleteDoc(doc(db, "users", currentUserDoc.id, "usage", "videoExports", "weeks", weekId));
    await renderWeeklyVideoExportUsage();
    setMessage("subscriptionMessage", `${weekLabel} 주간 영상 출력 횟수를 초기화했습니다.`);
  } catch (error) {
    setMessage("subscriptionMessage", error?.message ?? "주간 영상 출력 초기화 중 문제가 발생했습니다.");
  }
};

$("productSelect").addEventListener("change", (event) => {
  fillSubscriptionForm(event.target.value);
  renderSelectedPlanEntitlements(event.target.value);
});

$("subscriptionForm").addEventListener("submit", saveProductSubscription);
$("resetWeeklyVideoExportButton").addEventListener("click", resetWeeklyVideoExport);

$("markBackupExpiredButton").addEventListener("click", async () => {
  if (!currentUserDoc) return;
  setMessage("backupMessage", "처리 중입니다.");
  const deleteAfter = getDeleteAfter(currentSubscription?.expiresAt);

  try {
    await setAdminBackupStatus({
      targetUid: currentUserDoc.id,
      status: "expired",
      deleteAfter
    });
    setMessage("backupMessage", "백업을 만료 상태로 표시했습니다.");
    await loadUserDetail();
  } catch (error) {
    setMessage("backupMessage", error?.message ?? "백업 상태 변경 중 문제가 발생했습니다.");
  }
});

$("deleteBackupButton").addEventListener("click", async () => {
  if (!currentUserDoc) return;
  const confirmed = window.confirm(
    "선택한 사용자의 전체 클라우드 백업을 삭제할까요? 사진·영상·음악·프로젝트 메타데이터·백업 프로젝트 슬롯과 연결된 Storage 파일이 삭제됩니다. 사용자의 로컬 기기 원본은 삭제되지 않습니다."
  );
  if (!confirmed) return;

  setMessage("backupMessage", "전체 클라우드 데이터를 삭제하는 중입니다.");

  try {
    const result = await deleteAdminCloudBackupData({
      targetUid: currentUserDoc.id
    });
    const data = result.data ?? {};
    resetBackupManager();
    await loadUserDetail();
    setMessage(
      "backupMessage",
      `전체 클라우드 데이터를 삭제했습니다. 사진 ${Number(data.photoCount ?? 0)}개 · 영상 ${Number(data.videoCount ?? 0)}개 · 음악 ${Number(data.musicCount ?? 0)}개`
    );
  } catch (error) {
    setMessage("backupMessage", error?.message ?? "전체 클라우드 데이터 삭제 중 문제가 발생했습니다.");
  }
});

backupTabs.forEach((tab) => {
  document.querySelector(`[data-backup-tab="${tab}"]`)?.addEventListener("click", () => {
    loadBackupItems(tab);
  });
});

$("backupProjectFilterSelect").addEventListener("change", () => {
  backupPagesByTab[activeBackupTab] = 1;
  renderBackupItems();
});

$("backupUploadButton").addEventListener("click", () => {
  if (!currentUserDoc) {
    setMessage("backupItemsMessage", "사용자를 먼저 선택하세요.");
    return;
  }
  $("backupUploadInput").click();
});

$("backupUploadInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  uploadAdminBackupFile(file);
});

$("prevBackupItemsPageButton").addEventListener("click", () => {
  backupPagesByTab[activeBackupTab] -= 1;
  renderBackupItems();
});

$("nextBackupItemsPageButton").addEventListener("click", () => {
  backupPagesByTab[activeBackupTab] += 1;
  renderBackupItems();
});
