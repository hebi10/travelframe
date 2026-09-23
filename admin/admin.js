import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-functions.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
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
    priceLabel: "2,000원",
    description: "2,000원 1회 결제 상품입니다. 광고만 제거하며 프로젝트 최대 2개, 프로젝트당 사진 최대 100장, 클라우드 백업은 제공하지 않습니다."
  },
  creator_monthly: {
    cardId: "creatorMonthlyCard",
    statusId: "creatorMonthlyStatusLabel",
    detailId: "creatorMonthlyDetail",
    productName: "Pro",
    priceLabel: "월 2,000원",
    description: "프로젝트 수 무제한, 프로젝트당 사진 최대 365장, 클라우드 백업 프로젝트 1개를 제공합니다."
  },
  plus_monthly: {
    cardId: "plusMonthlyCard",
    statusId: "plusMonthlyStatusLabel",
    detailId: "plusMonthlyDetail",
    productName: "Plus",
    priceLabel: "월 4,000원",
    description: "프로젝트 수 무제한, 프로젝트당 사진 최대 365장, 클라우드 백업 프로젝트 최대 3개를 제공합니다."
  },
  expert_monthly: {
    cardId: "expertMonthlyCard",
    statusId: "expertMonthlyStatusLabel",
    detailId: "expertMonthlyDetail",
    productName: "Expert",
    priceLabel: "월 6,000원",
    description: "프로젝트 수 무제한, 프로젝트당 사진 최대 365장, 클라우드 백업 프로젝트 최대 5개를 제공합니다."
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

const adminPlanLabels = {
  free: "무료",
  ad_remove: "광고 제거",
  pro: "Pro",
  plus: "Plus",
  expert: "Expert"
};

const setupSubscriptionPanel = () => {
  subscriptionPanel.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">SUBSCRIPTION</p>
        <h2>구독 설정</h2>
        <p class="meta">광고 제거는 1회성 상품이며 Pro, Plus, Expert는 1개월 단위 구독입니다.</p>
      </div>
    </div>
    <div class="subscription-editor-layout">
      <form id="subscriptionForm" class="form subscription-form">
        <div class="form-grid">
          <label>
            플랜
            <select id="productSelect">
              <option value="ad_remove">광고 제거 · 1회성</option>
              <option value="creator_monthly">Pro · 1개월 구독</option>
              <option value="plus_monthly">Plus · 1개월 구독</option>
              <option value="expert_monthly">Expert · 1개월 구독</option>
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
          <label id="productStartLabel">
            시작일
            <input id="productStartInput" type="date" />
          </label>
          <label id="subscriptionDurationLabel">
            기간
            <select id="subscriptionDurationSelect">
              <option value="1">1개월</option>
              <option value="2">2개월</option>
              <option value="3">3개월</option>
              <option value="6">6개월</option>
              <option value="12">12개월</option>
              <option value="custom">직접 지정</option>
            </select>
          </label>
          <label id="productExpiresLabel">
            만료일
            <input id="productExpiresInput" type="date" />
          </label>
          <label class="full">
            관리자 메모
            <textarea id="adminNoteInput" maxlength="200" placeholder="처리 사유, 테스트 계정 메모 등을 남겨 주세요."></textarea>
          </label>
        </div>
        <div class="subscription-form-footer">
          <p id="subscriptionPeriodHelp" class="meta">월 구독은 시작일을 기준으로 선택한 기간만큼 만료일이 자동 계산됩니다.</p>
          <button type="submit">구독 저장</button>
        </div>
      </form>
      <aside class="subscription-policy-panel">
        <h3>상품 정책</h3>
        <div class="policy-list">
          <div><span class="meta">광고 제거</span><strong>1회성 · 만료일 없음</strong></div>
          <div><span class="meta">Pro / Plus / Expert</span><strong>1개월 단위 구독</strong></div>
          <div><span class="meta">영상 출력</span><strong>로그인 사용자는 제한 없음</strong></div>
        </div>
        <p class="operation-note">관리자에서 저장한 값은 앱에 즉시 반영됩니다. Google Play 구독 정보가 이후 동기화되면 실제 결제 상태로 다시 갱신될 수 있습니다.</p>
      </aside>
    </div>
    <p id="subscriptionMessage" class="message"></p>
  `;
};

setupSubscriptionPanel();


const adminTabPanelIds = {
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

  const panelIds = ["userDetailPanel", "subscriptionManagePanel", "backupManagePanel"];

  panelIds.forEach((panelId) => {
    $(panelId)?.classList.toggle("hidden", panelId !== adminTabPanelIds[target]);
  });
};

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.setAttribute("type", "button");
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

const toLocalDateValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const addCalendarMonths = (dateValue, months) => {
  if (!dateValue || !Number.isFinite(Number(months))) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return "";

  const targetMonthIndex = month - 1 + Number(months);
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);

  return [
    String(targetYear).padStart(4, "0"),
    String(normalizedMonthIndex + 1).padStart(2, "0"),
    String(targetDay).padStart(2, "0")
  ].join("-");
};

const getMonthDistance = (startValue, endValue) => {
  if (!startValue || !endValue) return null;
  for (const months of [1, 2, 3, 6, 12]) {
    if (addCalendarMonths(startValue, months) === endValue) return String(months);
  }
  return "custom";
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
  const isOneTime = productId === "ad_remove";
  const startValue = toDateInput(subscription?.startedAt) || toLocalDateValue();
  const expiresValue = toDateInput(subscription?.expiresAt);

  $("productSelect").value = productId;
  $("productStatusSelect").value = subscription?.status ?? "inactive";
  $("productStartInput").value = isOneTime ? "" : startValue;
  $("productExpiresInput").value = isOneTime
    ? ""
    : expiresValue || addCalendarMonths(startValue, 1);
  $("subscriptionDurationSelect").value = isOneTime
    ? "1"
    : getMonthDistance(startValue, $("productExpiresInput").value) ?? "1";

  $("productStartInput").disabled = isOneTime;
  $("productExpiresInput").disabled = isOneTime;
  $("subscriptionDurationSelect").disabled = isOneTime;
  $("productStartLabel").classList.toggle("is-disabled", isOneTime);
  $("productExpiresLabel").classList.toggle("is-disabled", isOneTime);
  $("subscriptionDurationLabel").classList.toggle("is-disabled", isOneTime);
  $("subscriptionPeriodHelp").textContent = isOneTime
    ? "광고 제거는 1회성 상품이므로 기간과 만료일을 사용하지 않습니다."
    : "월 구독은 시작일을 기준으로 선택한 기간만큼 만료일이 자동 계산됩니다.";
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
  $("adminIdentity")?.classList.toggle("hidden", !enabled);
  document.querySelector(".ops-menu")?.classList.toggle("hidden", !enabled);
  if (enabled && currentAdmin) {
    $("adminIdentity").textContent = currentAdmin.email || "관리자";
  }
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

const setSelectedUserPanelsVisible = (hasSelectedUser) => {
  $("selectedUserHeader")?.classList.toggle("hidden", !hasSelectedUser);
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
  setSelectedUserPanelsVisible(false);
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
  const keyword = $("searchInput").value.trim().toLowerCase();
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
    $("userCountLabel").textContent = String(allUsers.length);
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

    const main = document.createElement("span");
    main.className = "user-row-main";

    const title = document.createElement("strong");
    title.textContent = user.displayName || user.email || "이름 없음";

    const email = document.createElement("span");
    email.className = "meta";
    email.textContent = user.email || "이메일 없음";

    const detail = document.createElement("span");
    detail.className = "meta";
    detail.textContent = `마지막 로그인 · ${formatDate(user.lastSignInAt || user.createdAt)}`;

    const dot = document.createElement("span");
    dot.className = "user-status-dot";
    dot.setAttribute("aria-hidden", "true");

    main.append(title, email, detail);
    button.append(main, dot);
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
  $("userCountLabel").textContent = String(allUsers.length);
  $("usersPageInfo").textContent = `${usersPage} / ${totalPages}`;
  $("usersPageInfo").title = `${start + 1}-${Math.min(
    start + usersPageSize,
    filtered.length
  )}명 표시`;
  $("prevUsersPageButton").disabled = usersPage <= 1;
  $("nextUsersPageButton").disabled = usersPage >= totalPages;
};

const refreshGlobalStats = async () => {
  if (!allUsers.length) {
    $("statSubscriptions").textContent = "0";
    $("statBackupUsers").textContent = "0";
    return;
  }

  try {
    const summaries = await Promise.all(
      allUsers.map(async (user) => {
        const [subscriptionSnapshot, backupSnapshot] = await Promise.all([
          getDoc(doc(db, "users", user.id, "subscriptions", "current")),
          getDoc(doc(db, "users", user.id, "backups", "current"))
        ]);
        const subscription = subscriptionSnapshot.exists()
          ? subscriptionSnapshot.data()
          : null;
        const backup = backupSnapshot.exists() ? backupSnapshot.data() : null;
        const backupCount =
          Number(backup?.photoCount ?? 0) +
          Number(backup?.imageBundleCount ?? 0) +
          Number(backup?.videoCount ?? 0) +
          Number(backup?.musicCount ?? 0);

        return {
          activeSubscription:
            isSubscriptionActive(subscription) &&
            ["creator_monthly", "plus_monthly", "expert_monthly"].includes(
              subscription?.productId
            ),
          backupActive: backupCount > 0
        };
      })
    );

    $("statSubscriptions").textContent = String(
      summaries.filter((item) => item.activeSubscription).length
    );
    $("statBackupUsers").textContent = String(
      summaries.filter((item) => item.backupActive).length
    );
  } catch {
    $("statSubscriptions").textContent = "-";
    $("statBackupUsers").textContent = "-";
  }
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
    await refreshGlobalStats();
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
    title.className = "backup-item-title";
    title.textContent = item.title;
    title.title = item.title;
    const detail = document.createElement("span");
    detail.className = "meta";
    detail.textContent = item.detail;
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
$("refreshUsersButton").addEventListener("click", loadUsers);
$("searchInput").addEventListener("input", () => {
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
    musicTracks
  ] = await Promise.all([
    getDoc(doc(db, "users", uid, "subscriptions", "current")),
    getDoc(doc(db, "users", uid, "subscriptions", "ad_remove")),
    getDoc(doc(db, "users", uid, "subscriptions", "creator_monthly")),
    getDoc(doc(db, "users", uid, "subscriptions", "plus_monthly")),
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

  $("userUid").textContent = uid;
  $("userEmail").textContent = currentUserDoc.email ?? "-";
  $("userName").textContent = currentUserDoc.displayName ?? "-";
  $("userLastSignIn").textContent = formatDate(currentUserDoc.lastSignInAt);

  const imageBundleCount = currentBackup?.imageBundleCount ?? 0;
  const videoCount = currentBackup?.videoCount ?? 0;
  const musicCount = currentBackup?.musicCount ?? musicTracks.size;
  const backupCount = photoBackups.size + imageBundleCount + videoCount + musicCount;
  const planTier = getAdminPlanTier();
  const adRemoveActive = isSubscriptionActive(currentProductSubscriptions.ad_remove);

  $("selectedUserName").textContent =
    currentUserDoc.displayName || currentUserDoc.email || "사용자";
  $("selectedUserEmail").textContent = currentUserDoc.email ?? "-";
  $("selectedUserAvatar").textContent = (
    currentUserDoc.displayName ||
    currentUserDoc.email ||
    "U"
  ).trim().slice(0, 1).toUpperCase();
  $("selectedAdBadge").textContent = `광고 제거 ${adRemoveActive ? "활성" : "비활성"}`;
  $("selectedAdBadge").classList.toggle("active", adRemoveActive);
  $("selectedPlanBadge").textContent = adminPlanLabels[planTier] ?? "무료";
  $("selectedPlanBadge").classList.toggle("active", planTier !== "free");
  $("selectedBackupBadge").textContent = `백업 ${backupCount}개`;
  $("selectedBackupBadge").classList.toggle("active", backupCount > 0);

  renderSubscriptionCards();
  fillSubscriptionForm($("productSelect").value || "ad_remove");

  $("backupStatus").textContent = currentBackup?.status ?? "없음";
  $("backupDeleteAfter").textContent = formatDate(currentBackup?.deleteAfter);
  $("backupCounts").textContent = `사진 ${photoBackups.size}개 / 작업 ${imageBundleCount}개 / 동영상 ${videoCount}개 / 음악 ${musicCount}개`;

  setSelectedUserPanelsVisible(true);
};

const saveProductSubscription = async (event) => {
  event.preventDefault();

  if (!currentAdmin || !currentUserDoc) return;

  setMessage("subscriptionMessage", "저장 중입니다.");

  const productId = $("productSelect").value;
  const selectedStatus = $("productStatusSelect").value;
  const startValue = $("productStartInput").value;
  const expiresValue = $("productExpiresInput").value;
  const durationValue = $("subscriptionDurationSelect").value;
  const startedAt =
    productId === "ad_remove" || !startValue
      ? null
      : new Date(`${startValue}T00:00:00`).toISOString();
  const expiresAt =
    productId === "ad_remove" || !expiresValue
      ? null
      : new Date(`${expiresValue}T23:59:59`).toISOString();
  const termMonths =
    productId === "ad_remove" || durationValue === "custom"
      ? null
      : Number(durationValue);

  if (
    productId !== "ad_remove" &&
    selectedStatus === "active" &&
    (!startedAt || !expiresAt)
  ) {
    setMessage("subscriptionMessage", "활성 월 구독은 시작일과 만료일을 입력해 주세요.");
    return;
  }

  try {
    await setAdminProductSubscription({
      targetUid: currentUserDoc.id,
      productId,
      status: selectedStatus,
      startedAt,
      expiresAt,
      termMonths,
      adminNote: $("adminNoteInput").value.trim() || null
    });

    setMessage("subscriptionMessage", "상품 상태를 저장했습니다.");
    await loadUserDetail();
  } catch (error) {
    setMessage("subscriptionMessage", error?.message ?? "상품 상태 저장 중 문제가 발생했습니다.");
  }
};


const syncSubscriptionExpiry = () => {
  const productId = $("productSelect").value;
  const duration = $("subscriptionDurationSelect").value;
  if (productId === "ad_remove" || duration === "custom") return;

  const startValue = $("productStartInput").value || toLocalDateValue();
  $("productStartInput").value = startValue;
  $("productExpiresInput").value = addCalendarMonths(startValue, Number(duration));
};

$("productSelect").addEventListener("change", (event) => {
  fillSubscriptionForm(event.target.value);
});
$("subscriptionDurationSelect").addEventListener("change", syncSubscriptionExpiry);
$("productStartInput").addEventListener("change", syncSubscriptionExpiry);
$("productExpiresInput").addEventListener("change", () => {
  if ($("productSelect").value === "ad_remove") return;
  $("subscriptionDurationSelect").value =
    getMonthDistance($("productStartInput").value, $("productExpiresInput").value) ||
    "custom";
});
$("subscriptionForm").addEventListener("submit", saveProductSubscription);

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


document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = $(button.dataset.copyTarget);
    const value = target?.textContent?.trim();
    if (!value || value === "-") return;

    try {
      await navigator.clipboard.writeText(value);
      const original = button.textContent;
      button.textContent = "복사됨";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1200);
    } catch {
      window.prompt("복사할 값입니다.", value);
    }
  });
});

document.querySelectorAll("[data-open-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    setAdminSectionTab("rightAdminTabs", button.dataset.openAdminTab);
  });
});
