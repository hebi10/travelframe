import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  addDoc,
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
  creator_monthly: null
};
let currentBackup = null;
let isCreatingRegularAccount = false;
let allUsers = [];
let usersPage = 1;
const usersPageSize = 10;

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

const setupSubscriptionPanel = () => {
  subscriptionPanel.innerHTML = `
    <h2>구독 관리</h2>
    <div class="subscription-summary" aria-label="상품별 구독 상태">
      <div id="adRemoveCard" class="subscription-product-card">
        <span class="meta">광고 제거</span>
        <strong id="adRemoveStatusLabel">-</strong>
        <span id="adRemoveDetail" class="meta">-</span>
      </div>
      <div id="creatorMonthlyCard" class="subscription-product-card">
        <span class="meta">영상 내보내기</span>
        <strong id="creatorMonthlyStatusLabel">-</strong>
        <span id="creatorMonthlyDetail" class="meta">-</span>
      </div>
    </div>
    <form id="subscriptionForm" class="form">
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
      <label>
        관리자 메모
        <textarea id="adminNoteInput" placeholder="처리 사유, 테스트 계정 메모 등을 남겨 주세요."></textarea>
      </label>
      <button type="submit">상품 상태 저장</button>
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

const toDateInput = (value) => {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
};

const isSubscriptionActive = (subscription) => {
  if (!subscription || subscription.plan !== "premium" || subscription.status !== "active") {
    return false;
  }

  const expiresAt = parseDate(subscription.expiresAt);
  return !expiresAt || expiresAt.getTime() > Date.now();
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
      productId,
      ...current
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

const createFreeSubscription = () => ({
  plan: "free",
  productId: "free",
  status: "inactive",
  provider: "admin",
  startedAt: null,
  expiresAt: null,
  lastPaymentAt: null,
  priceLabel: "무료",
  productName: "무료",
  updatedBy: currentAdmin?.uid ?? null,
  updatedAt: serverTimestamp()
});

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

const syncCurrentSubscription = async (uid, nextSubscriptions) => {
  const effectiveSubscription = getEffectiveSubscription(nextSubscriptions);
  await setDoc(
    doc(db, "users", uid, "subscriptions", "current"),
    {
      ...(effectiveSubscription ?? createFreeSubscription()),
      updatedBy: currentAdmin?.uid ?? null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
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

const resetUserPanels = () => {
  currentUserDoc = null;
  currentSubscription = null;
  currentProductSubscriptions = {
    ad_remove: null,
    creator_monthly: null
  };
  currentBackup = null;
  userPanel.classList.add("hidden");
  subscriptionPanel.classList.add("hidden");
  backupPanel.classList.add("hidden");
  $("statPlan").textContent = "-";
  $("statBackups").textContent = "-";
  $("statStatus").textContent = "-";
};

const requireAdmin = async (user) => {
  if (!user) return false;
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  return adminSnap.exists();
};

const renderUserList = () => {
  const keyword = $("userFilterInput").value.trim().toLowerCase();
  const filtered = allUsers.filter((user) => {
    const target = [user.email, user.displayName, user.id].filter(Boolean).join(" ").toLowerCase();
    return target.includes(keyword);
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
    let userSnap = await getDoc(doc(db, "users", term));
    if (!userSnap.exists()) {
      const found = await getDocs(
        query(collection(db, "users"), where("email", "==", term), limit(1))
      );
      userSnap = found.docs[0] ?? null;
    }

    if (!userSnap?.exists()) {
      setMessage("searchMessage", "사용자를 찾지 못했습니다.");
      renderUserList();
      return;
    }

    currentUserDoc = {
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

const loadUserDetail = async () => {
  if (!currentUserDoc) return;

  const uid = currentUserDoc.id;
  const [
    subscriptionSnap,
    adRemoveSnap,
    creatorMonthlySnap,
    backupSnap,
    photoBackups
  ] = await Promise.all([
    getDoc(doc(db, "users", uid, "subscriptions", "current")),
    getDoc(doc(db, "users", uid, "subscriptions", "ad_remove")),
    getDoc(doc(db, "users", uid, "subscriptions", "creator_monthly")),
    getDoc(doc(db, "users", uid, "backups", "current")),
    getDocs(collection(db, "users", uid, "photoBackups"))
  ]);

  currentSubscription = subscriptionSnap.exists() ? subscriptionSnap.data() : null;
  currentProductSubscriptions = {
    ad_remove: resolveProductSubscription("ad_remove", adRemoveSnap, currentSubscription),
    creator_monthly: resolveProductSubscription(
      "creator_monthly",
      creatorMonthlySnap,
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
  $("statBackups").textContent = String(photoBackups.size);
  $("statStatus").textContent = activeProductIds.length
    ? `${activeProductIds.length}개 활성`
    : "비활성";

  renderSubscriptionCards();
  fillSubscriptionForm($("productSelect").value || "ad_remove");

  $("backupStatus").textContent = currentBackup?.status ?? "없음";
  $("backupDeleteAfter").textContent = formatDate(currentBackup?.deleteAfter);
  $("backupCounts").textContent = `사진 ${photoBackups.size}개 / 작업 ${
    currentBackup?.imageBundleCount ?? 0
  }개 / 영상 ${currentBackup?.videoCount ?? 0}개`;

  userPanel.classList.remove("hidden");
  subscriptionPanel.classList.remove("hidden");
  backupPanel.classList.remove("hidden");
};

const saveProductSubscription = async (event) => {
  event.preventDefault();

  if (!currentAdmin || !currentUserDoc) return;

  setMessage("subscriptionMessage", "저장 중입니다.");

  const productId = $("productSelect").value;
  const selectedStatus = $("productStatusSelect").value;
  const now = new Date();
  const expiresValue = $("productExpiresInput").value;
  const expiresAt = expiresValue ? new Date(`${expiresValue}T23:59:59`).toISOString() : null;
  const meta = productMeta[productId];
  const previousSubscription = currentProductSubscriptions[productId];

  const subscription = {
    plan: "premium",
    productId,
    status: selectedStatus,
    provider: "admin",
    startedAt: previousSubscription?.startedAt ?? now.toISOString(),
    expiresAt: productId === "creator_monthly" ? expiresAt : null,
    lastPaymentAt:
      selectedStatus === "active" ? now.toISOString() : previousSubscription?.lastPaymentAt ?? null,
    priceLabel: meta.priceLabel,
    productName: meta.productName,
    adminNote: $("adminNoteInput").value.trim() || null,
    updatedBy: currentAdmin.uid,
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(
      doc(db, "users", currentUserDoc.id, "subscriptions", productId),
      subscription,
      { merge: true }
    );
    const nextSubscriptions = {
      ...currentProductSubscriptions,
      [productId]: subscription
    };
    await syncCurrentSubscription(currentUserDoc.id, nextSubscriptions);
    await addDoc(collection(db, "users", currentUserDoc.id, "paymentEvents"), {
      type: "admin_subscription_updated",
      productId,
      productName: meta.productName,
      priceLabel: meta.priceLabel,
      status: subscription.status,
      provider: "admin",
      adminUid: currentAdmin.uid,
      adminEmail: currentAdmin.email ?? null,
      note: subscription.adminNote,
      createdAt: serverTimestamp()
    });

    setMessage("subscriptionMessage", "상품 상태를 저장했습니다.");
    await loadUserDetail();
  } catch (error) {
    setMessage("subscriptionMessage", error?.message ?? "상품 상태 저장 중 문제가 발생했습니다.");
  }
};

$("productSelect").addEventListener("change", (event) => {
  fillSubscriptionForm(event.target.value);
});

$("subscriptionForm").addEventListener("submit", saveProductSubscription);

$("markBackupExpiredButton").addEventListener("click", async () => {
  if (!currentUserDoc) return;
  setMessage("backupMessage", "처리 중입니다.");
  const deleteAfter = getDeleteAfter(currentSubscription?.expiresAt);

  try {
    await setDoc(
      doc(db, "users", currentUserDoc.id, "backups", "current"),
      {
        status: "expired",
        deleteAfter,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
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
    const photos = await getDocs(collection(db, "users", currentUserDoc.id, "photoBackups"));
    await Promise.all(photos.docs.map((item) => deleteDoc(item.ref)));
    await setDoc(
      doc(db, "users", currentUserDoc.id, "backups", "current"),
      {
        status: "deleted",
        deletedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    setMessage("backupMessage", "백업 문서를 삭제 처리했습니다.");
    await loadUserDetail();
  } catch (error) {
    setMessage("backupMessage", error?.message ?? "백업 삭제 중 문제가 발생했습니다.");
  }
});
