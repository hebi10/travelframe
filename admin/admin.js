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
  expert_monthly: null
};
let currentBackup = null;
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
const setAdminProductSubscription = httpsCallable(functions, "setAdminProductSubscription");
const setAdminBackupStatus = httpsCallable(functions, "setAdminBackupStatus");

const productMeta = {
  ad_remove: {
    cardId: "adRemoveCard",
    statusId: "adRemoveStatusLabel",
    detailId: "adRemoveDetail",
    productName: "광고 제거",
    priceLabel: "3,900원",
    description: "1회 결제 상품입니다. 활성 상태면 광고 제거 혜택이 적용됩니다."
  },
  creator_monthly: {
    cardId: "creatorMonthlyCard",
    statusId: "creatorMonthlyStatusLabel",
    detailId: "creatorMonthlyDetail",
    productName: "영상 내보내기",
    priceLabel: "월 3,900원",
    description: "월결제 상품입니다. 활성 상태면 영상 내보내기와 백업 혜택이 적용됩니다."
  }
};

const paidProductIds = ["ad_remove", "creator_monthly"];

const statusLabels = {
  inactive: "비활성",
  active: "활성",
  expired: "만료"
};

const weeklyVideoExportLimits = {
  free: 1,
  ad_remove: 1,
  pro: 15,
  expert: 30
};

const adminPlanLabels = {
  free: "무료",
  ad_remove: "광고 제거",
  pro: "Pro",
  expert: "Expert"
};

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
    <form id="subscriptionForm" class="form form-grid">
      <label>
        관리할 상품
        <select id="productSelect">
          <option value="ad_remove">광고 제거 1회 결제</option>
          <option value="creator_monthly">영상 내보내기 월결제</option>
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
      두 상품은 별도로 저장됩니다. 앱 호환을 위해 현재 활성 상품 정보도 함께 갱신합니다.
    </p>
    <p id="subscriptionMessage" class="message"></p>
  `;
};

setupSubscriptionPanel();

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
      productId === "creator_monthly" && subscription?.expiresAt
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
  $("productExpiresInput").disabled = productId !== "creator_monthly";
  $("adminNoteInput").value = subscription?.adminNote ?? "";
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
    expert_monthly: null
  };
  currentBackup = null;
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
    button.className = `user-row ${currentUserDoc?.id === user.id ? "active" : ""}`;
    button.dataset.userId = user.id;

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
    storagePath: data.storagePath ?? "-"
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
    storagePath: Array.isArray(data.storagePaths) ? data.storagePaths[0] ?? "-" : "-"
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
    storagePath: data.storagePath ?? "-"
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
    storagePath: data.storagePath ?? "-"
  };
};

const renderBackupTabs = () => {
  backupTabs.forEach((tab) => {
    const button = document.querySelector(`[data-backup-tab="${tab}"]`);
    button?.classList.toggle("active", activeBackupTab === tab);
    button?.setAttribute("aria-selected", String(activeBackupTab === tab));
  });
  $("backupUploadInput").accept = backupUploadAccept[activeBackupTab] ?? "";
};

const renderBackupItems = () => {
  renderBackupTabs();
  const items = backupItemsByTab[activeBackupTab] ?? [];
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
    title.textContent = item.title;
    const detail = document.createElement("span");
    detail.className = "meta";
    detail.textContent = item.detail;
    const path = document.createElement("span");
    path.className = "uid";
    path.textContent = item.storagePath;
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
  const lines = [
    `종류: ${backupTabLabels[item.tab]}`,
    `ID: ${item.id}`,
    `Storage: ${item.storagePath}`,
    `URL: ${item.url ?? "-"}`
  ];
  if (item.url) {
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
  setMessage("backupItemsMessage", `${backupTabLabels[tab]} 파일 업로드를 준비하는 중입니다.`);
  try {
    const reservation = await reserveAdminBackupUpload({
      targetUid: currentUserDoc.id,
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
    expertMonthlySnap,
    backupSnap,
    photoBackups,
    musicTracks
  ] = await Promise.all([
    getDoc(doc(db, "users", uid, "subscriptions", "current")),
    getDoc(doc(db, "users", uid, "subscriptions", "ad_remove")),
    getDoc(doc(db, "users", uid, "subscriptions", "creator_monthly")),
    getDoc(doc(db, "users", uid, "subscriptions", "expert_monthly")),
    getDoc(doc(db, "users", uid, "backups", "current")),
    getDocs(collection(db, "users", uid, "photoBackups")),
    getDocs(collection(db, "users", uid, "musicTracks"))
  ]);

  currentSubscription = subscriptionSnap.exists() ? subscriptionSnap.data() : null;
  currentProductSubscriptions = {
    ad_remove: resolveProductSubscription("ad_remove", adRemoveSnap, currentSubscription),
    creator_monthly: resolveProductSubscription(
      "creator_monthly",
      creatorMonthlySnap,
      currentSubscription
    ),
    expert_monthly: resolveProductSubscription(
      "expert_monthly",
      expertMonthlySnap,
      currentSubscription
    )
  };
  currentBackup = backupSnap.exists() ? backupSnap.data() : null;

  $("userUid").textContent = uid;
  $("userEmail").textContent = currentUserDoc.email ?? "-";
  $("userName").textContent = currentUserDoc.displayName ?? "-";
  $("userLastSignIn").textContent = formatDate(currentUserDoc.lastSignInAt);

  const activeProductIds = getActiveProductIds();
  $("statPlan").textContent = activeProductIds.length
    ? activeProductIds.map((productId) => productMeta[productId]?.productName ?? productId).join(" + ")
    : "무료";
  const imageBundleCount = currentBackup?.imageBundleCount ?? 0;
  const videoCount = currentBackup?.videoCount ?? 0;
  const musicCount = currentBackup?.musicCount ?? musicTracks.size;
  $("statBackups").textContent = String(photoBackups.size + imageBundleCount + videoCount + musicCount);
  $("statStatus").textContent = activeProductIds.length
    ? `${activeProductIds.length}개 활성`
    : "비활성";

  renderSubscriptionCards();
  fillSubscriptionForm($("productSelect").value || "ad_remove");

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
      expiresAt: productId === "creator_monthly" ? expiresAt : null,
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
    "백업 문서를 삭제 처리할까요? Storage 원본 파일은 Firebase Console 또는 서버 작업에서 별도 확인이 필요합니다."
  );
  if (!confirmed) return;

  setMessage("backupMessage", "삭제 처리 중입니다.");

  try {
    const [photos, imageWorks, videos, musicTracks] = await Promise.all([
      getDocs(collection(db, "users", currentUserDoc.id, "photoBackups")),
      getDocs(collection(db, "users", currentUserDoc.id, "imageWorks")),
      getDocs(collection(db, "users", currentUserDoc.id, "videos")),
      getDocs(collection(db, "users", currentUserDoc.id, "musicTracks"))
    ]);
    const deleteTasks = [
      ...photos.docs.map((item) =>
        deleteAdminBackupItem({
          targetUid: currentUserDoc.id,
          itemType: "photo",
          itemId: item.id
        })
      ),
      ...imageWorks.docs.map((item) =>
        deleteAdminBackupItem({
          targetUid: currentUserDoc.id,
          itemType: "imageWork",
          itemId: item.id
        })
      ),
      ...videos.docs.map((item) =>
        deleteAdminBackupItem({
          targetUid: currentUserDoc.id,
          itemType: "video",
          itemId: item.id
        })
      ),
      ...musicTracks.docs.map((item) =>
        deleteAdminBackupItem({
          targetUid: currentUserDoc.id,
          itemType: "music",
          itemId: item.id
        })
      )
    ];

    await Promise.all(deleteTasks);
    await setAdminBackupStatus({
      targetUid: currentUserDoc.id,
      status: "deleted"
    });
    setMessage("backupMessage", "백업 문서를 삭제 처리했습니다.");
    await loadUserDetail();
  } catch (error) {
    setMessage("backupMessage", error?.message ?? "백업 삭제 중 문제가 발생했습니다.");
  }
});

backupTabs.forEach((tab) => {
  document.querySelector(`[data-backup-tab="${tab}"]`)?.addEventListener("click", () => {
    loadBackupItems(tab);
  });
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
