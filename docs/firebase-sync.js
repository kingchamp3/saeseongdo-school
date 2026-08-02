import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2-Qei_N2QF0V3Bq-jkNPuWoQ12yXghc0",
  authDomain: "new-saint-school.firebaseapp.com",
  projectId: "new-saint-school",
  storageBucket: "new-saint-school.firebasestorage.app",
  messagingSenderId: "115593309767",
  appId: "1:115593309767:web:afd8129e0bff29ef57cb62",
  measurementId: "G-Q5QGE5S0L3",
};

export const ADMIN_EMAIL = "kingchamp3@gmail.com";
const VIEWER_EMAIL = "viewer@new-saint-school.web.app";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export function isAdminUser(user) {
  return (
    user?.email?.toLowerCase() === ADMIN_EMAIL &&
    user.emailVerified === true &&
    user.providerData?.some((provider) => provider.providerId === "google.com")
  );
}

export function hasDashboardAccess(user) {
  const isViewer =
    user?.email?.toLowerCase() === VIEWER_EMAIL &&
    user.providerData?.some((provider) => provider.providerId === "password");
  return Boolean(isViewer || isAdminUser(user));
}

function requireAdmin() {
  if (!isAdminUser(auth.currentUser)) {
    throw new Error("마스터 Google 인증이 필요합니다.");
  }
}

function makeMemberId() {
  if (globalThis.crypto?.randomUUID) {
    return `member-${globalThis.crypto.randomUUID()}`;
  }
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribeAuth(callback) {
  let active = true;
  let stopAuth = () => {};
  void setPersistence(auth, browserSessionPersistence)
    .catch(() => undefined)
    .then(() => {
      if (!active) return;
      stopAuth = onAuthStateChanged(auth, callback);
    });
  return () => {
    active = false;
    stopAuth();
  };
}

export async function signInViewer(password) {
  await setPersistence(auth, browserSessionPersistence);
  const result = await signInWithEmailAndPassword(auth, VIEWER_EMAIL, password);
  if (!hasDashboardAccess(result.user)) {
    await signOut(auth);
    throw new Error("접속 권한을 확인할 수 없습니다.");
  }
  return result.user;
}

export async function signOutViewer() {
  await signOut(auth);
}

export function subscribeSharedData({
  onMembers,
  onCompletions,
  onError,
}) {
  const stopMembers = onSnapshot(
    query(collection(db, "members"), limit(200)),
    (snapshot) => {
      onMembers(
        snapshot.docs
          .map((record) => ({ id: record.id, ...record.data() }))
          .filter((member) => member.active !== false),
      );
    },
    (error) => onError(error),
  );

  const stopCompletions = onSnapshot(
    query(collection(db, "completions"), limit(5000)),
    (snapshot) => {
      onCompletions(
        snapshot.docs.map((record) => ({ id: record.id, ...record.data() })),
      );
    },
    (error) => onError(error),
  );

  return () => {
    stopMembers();
    stopCompletions();
  };
}

export async function signInMaster() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  if (!isAdminUser(result.user)) {
    await signOut(auth);
    throw new Error("등록된 마스터 계정만 사용할 수 있습니다.");
  }
  return result.user;
}

export async function signOutMaster() {
  await signOut(auth);
}

export async function addMember(name, leaderId) {
  requireAdmin();
  const id = makeMemberId();
  const now = serverTimestamp();
  await setDoc(doc(db, "members", id), {
    id,
    name,
    leaderId,
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
    active: true,
  });
  return id;
}

export async function changeMemberLeader(memberId, leaderId) {
  requireAdmin();
  await updateDoc(doc(db, "members", memberId), {
    leaderId,
    updatedAt: serverTimestamp(),
  });
}

export async function removeMember(memberId, completionIds) {
  requireAdmin();
  const batch = writeBatch(db);
  completionIds.forEach((completionId) => {
    batch.delete(doc(db, "completions", completionId));
  });
  batch.delete(doc(db, "members", memberId));
  await batch.commit();
}

export async function setItemCompletion(memberId, itemId, complete) {
  requireAdmin();
  const completionId = `${memberId}__${itemId}`;
  const completionRef = doc(db, "completions", completionId);
  if (!complete) {
    await deleteDoc(completionRef);
    return;
  }
  await setDoc(completionRef, {
    memberId,
    itemId,
    course: 1,
    completedAt: serverTimestamp(),
  });
}
