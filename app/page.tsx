"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
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
} from "firebase/firestore";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  regionLeader,
  school1Curriculum,
  school1TotalItems,
  zoneLeaders,
} from "../docs/curriculum.js";
import "./didimdol.css";

const firebaseConfig = {
  apiKey: "AIzaSyB2-Qei_N2QF0V3Bq-jkNPuWoQ12yXghc0",
  authDomain: "new-saint-school.firebaseapp.com",
  projectId: "new-saint-school",
  storageBucket: "new-saint-school.firebasestorage.app",
  messagingSenderId: "115593309767",
  appId: "1:115593309767:web:afd8129e0bff29ef57cb62",
  measurementId: "G-Q5QGE5S0L3",
};

const ADMIN_EMAIL = "kingchamp3@gmail.com";
const VIEWER_EMAIL = "viewer@new-saint-school.web.app";
const DEFAULT_PIN = "1925";
const PIN_STORAGE_KEY = "didimdol-screen-lock-pin";
const THEME_STORAGE_KEY = "didimdol-theme";
const FALLBACK_MEMBER_ID = "empty-member";

type DateValue =
  | Date
  | string
  | number
  | { toDate?: () => Date }
  | null
  | undefined;

type CurriculumItem = {
  id: string;
  title: string;
};

type CurriculumStage = {
  id: number;
  title: string;
  items: CurriculumItem[];
};

type ZoneLeader = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  name: string;
  leaderId: string;
  registeredAt: DateValue;
  createdAt: DateValue;
  updatedAt: DateValue;
  active: boolean;
  isFallback?: boolean;
};

type Completion = {
  id: string;
  memberId: string;
  itemId: string;
  course: number;
  completedAt: DateValue;
};

type MemberProgress = {
  member: Member;
  completed: number;
  percent: number;
  currentStage: number;
  allComplete: boolean;
};

const curriculum = school1Curriculum as CurriculumStage[];
const leaders = zoneLeaders as ZoneLeader[];
const totalItems =
  Number(school1TotalItems) ||
  curriculum.reduce((sum, stage) => sum + stage.items.length, 0);

const fallbackMember: Member = {
  id: FALLBACK_MEMBER_ID,
  name: "등록된 새성도 없음",
  leaderId: "unassigned",
  registeredAt: null,
  createdAt: null,
  updatedAt: null,
  active: true,
  isFallback: true,
};

function getFirebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

function isAuthorizedAdmin(user: User | null) {
  return (
    user?.email?.toLowerCase() === ADMIN_EMAIL &&
    user.emailVerified === true &&
    user.providerData.some((provider) => provider.providerId === "google.com")
  );
}

function isSharedViewer(user: User | null) {
  return (
    user?.email?.toLowerCase() === VIEWER_EMAIL &&
    user.providerData.some((provider) => provider.providerId === "password")
  );
}

function hasDashboardAccess(user: User | null) {
  return isSharedViewer(user) || isAuthorizedAdmin(user);
}

function formatDate(value: DateValue, includeTime = false) {
  if (!value) return "기록 없음";

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object" && value.toDate) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "기록 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(date);
}

function makeMemberId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `member-${Date.now().toString(36)}`;
}

function getInitial(name: string) {
  return name.trim().slice(0, 1) || "새";
}

export default function Home() {
  const [remoteMembers, setRemoteMembers] = useState<Member[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [completionsLoaded, setCompletionsLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [masterMode, setMasterMode] = useState(false);
  const [masterGateOpen, setMasterGateOpen] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [gateMessage, setGateMessage] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(FALLBACK_MEMBER_ID);
  const [selectedLeaderId, setSelectedLeaderId] = useState("all");
  const [openStage, setOpenStage] = useState<number | null>(1);
  const [darkMode, setDarkMode] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberLeader, setNewMemberLeader] = useState(
    leaders[0]?.id ?? "unassigned",
  );
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinChangeMessage, setPinChangeMessage] = useState("");
  const touchTaps = useRef<number[]>([]);

  const adminUser = isAuthorizedAdmin(user);
  const canManage = masterMode && adminUser;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)",
    ).matches;
    setDarkMode(savedTheme ? savedTheme === "dark" : Boolean(prefersDark));

    const { auth } = getFirebase();
    let cancelled = false;
    let stopAuth: (() => void) | undefined;

    void setPersistence(auth, browserSessionPersistence)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        stopAuth = onAuthStateChanged(auth, (nextUser) => {
          if (nextUser && !hasDashboardAccess(nextUser)) {
            setUser(null);
            setMasterMode(false);
            void signOut(auth).finally(() => {
              if (!cancelled) setAuthResolved(true);
            });
            return;
          }
          setUser(nextUser);
          setAuthResolved(true);
          if (!isAuthorizedAdmin(nextUser)) setMasterMode(false);
        });
      });

    return () => {
      cancelled = true;
      stopAuth?.();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setRemoteMembers([]);
      setCompletions([]);
      setMembersLoaded(false);
      setCompletionsLoaded(false);
      setConnectionError("");
      return;
    }

    setMembersLoaded(false);
    setCompletionsLoaded(false);
    setConnectionError("");
    const { db } = getFirebase();

    const stopMembers = onSnapshot(
      query(collection(db, "members"), limit(200)),
      (snapshot) => {
        const records = snapshot.docs
          .map((snapshotDoc) => {
            const data = snapshotDoc.data();
            return {
              id:
                typeof data.id === "string" && data.id
                  ? data.id
                  : snapshotDoc.id,
              name: typeof data.name === "string" ? data.name : "이름 미등록",
              leaderId:
                typeof data.leaderId === "string"
                  ? data.leaderId
                  : "unassigned",
              registeredAt: data.registeredAt as DateValue,
              createdAt: data.createdAt as DateValue,
              updatedAt: data.updatedAt as DateValue,
              active: data.active !== false,
            } satisfies Member;
          })
          .filter((member) => member.active);
        setRemoteMembers(records);
        setMembersLoaded(true);
        setConnectionError("");
      },
      () => {
        setMembersLoaded(true);
        setConnectionError(
          "공유 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      },
    );

    const stopCompletions = onSnapshot(
      query(collection(db, "completions"), limit(5000)),
      (snapshot) => {
        setCompletions(
          snapshot.docs.map((snapshotDoc) => {
            const data = snapshotDoc.data();
            return {
              id: snapshotDoc.id,
              memberId:
                typeof data.memberId === "string" ? data.memberId : "",
              itemId: typeof data.itemId === "string" ? data.itemId : "",
              course: Number(data.course) || 1,
              completedAt: data.completedAt as DateValue,
            } satisfies Completion;
          }),
        );
        setCompletionsLoaded(true);
        setConnectionError("");
      },
      () => {
        setCompletionsLoaded(true);
        setConnectionError(
          "진도 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      },
    );

    return () => {
      stopMembers();
      stopCompletions();
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      darkMode ? "dark" : "light",
    );
  }, [darkMode]);

  const members = useMemo(() => {
    if (!membersLoaded) return [];
    return remoteMembers.length ? remoteMembers : [fallbackMember];
  }, [membersLoaded, remoteMembers]);

  useEffect(() => {
    if (!members.length) return;
    if (!members.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, selectedMemberId]);

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) ?? members[0];

  const completionsByMember = useMemo(() => {
    const result = new Map<string, Map<string, Completion>>();
    for (const completion of completions) {
      if (!result.has(completion.memberId)) {
        result.set(completion.memberId, new Map());
      }
      result.get(completion.memberId)?.set(completion.itemId, completion);
    }
    return result;
  }, [completions]);

  function calculateProgress(member: Member): MemberProgress {
    const memberCompletions = completionsByMember.get(member.id) ?? new Map();
    const completed = curriculum.reduce(
      (sum, stage) =>
        sum +
        stage.items.filter((item) => memberCompletions.has(item.id)).length,
      0,
    );
    const firstIncomplete = curriculum.find((stage) =>
      stage.items.some((item) => !memberCompletions.has(item.id)),
    );
    const allComplete = !firstIncomplete && completed >= totalItems;
    return {
      member,
      completed,
      percent: totalItems ? Math.round((completed / totalItems) * 100) : 0,
      currentStage: allComplete
        ? 12
        : (firstIncomplete?.id ?? curriculum[0]?.id ?? 1),
      allComplete,
    };
  }

  const leaderboard = useMemo(
    () =>
      members
        .map(calculateProgress)
        .sort(
          (a, b) =>
            b.completed - a.completed ||
            a.member.name.localeCompare(b.member.name, "ko"),
        ),
    // calculateProgress reads the memoized completion map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, completionsByMember],
  );

  const visibleLeaderboard = useMemo(
    () =>
      selectedLeaderId === "all"
        ? leaderboard
        : leaderboard.filter(
            (entry) => entry.member.leaderId === selectedLeaderId,
          ),
    [leaderboard, selectedLeaderId],
  );

  useEffect(() => {
    if (selectedLeaderId === "all" || !visibleLeaderboard.length) return;
    if (
      !visibleLeaderboard.some(
        (entry) => entry.member.id === selectedMemberId,
      )
    ) {
      setSelectedMemberId(visibleLeaderboard[0].member.id);
      setOpenStage(1);
    }
  }, [selectedLeaderId, selectedMemberId, visibleLeaderboard]);

  const selectedProgress = selectedMember
    ? calculateProgress(selectedMember)
    : null;
  const selectedCompletions = selectedMember
    ? (completionsByMember.get(selectedMember.id) ?? new Map())
    : new Map<string, Completion>();
  const isFallbackOnly =
    Boolean(selectedMember?.isFallback) && remoteMembers.length === 0;

  const zoneSummaries = useMemo(
    () =>
      leaders.map((leader) => {
        const people = leaderboard.filter(
          (entry) => entry.member.leaderId === leader.id,
        );
        const average = people.length
          ? Math.round(
              people.reduce((sum, entry) => sum + entry.percent, 0) /
                people.length,
            )
          : 0;
        const completed = people.reduce(
          (sum, entry) => sum + entry.completed,
          0,
        );
        return { leader, people, average, completed };
      }),
    [leaderboard],
  );

  function leaderName(leaderId: string) {
    return (
      leaders.find((leader) => leader.id === leaderId)?.name ?? "미편성"
    );
  }

  const selectedZoneLabel =
    selectedLeaderId === "all"
      ? "전체 구역"
      : selectedLeaderId === "unassigned"
        ? "미편성"
        : leaderName(selectedLeaderId);

  function openMasterGate() {
    setMasterGateOpen(true);
    setPinUnlocked(false);
    setPinEntry("");
    setGateMessage("");
  }

  function handleLogoTouch(pointerType: string) {
    if (pointerType !== "touch") return;
    const now = Date.now();
    touchTaps.current = [...touchTaps.current.filter((time) => now - time < 1200), now];
    if (touchTaps.current.length >= 5) {
      touchTaps.current = [];
      openMasterGate();
    }
  }

  function unlockPin() {
    const savedPin =
      window.localStorage.getItem(PIN_STORAGE_KEY) ?? DEFAULT_PIN;
    if (pinEntry !== savedPin) {
      setGateMessage("화면 잠금 PIN을 다시 확인해 주세요.");
      return;
    }
    setPinUnlocked(true);
    setPinEntry("");
    setGateMessage(
      adminUser
        ? "PIN 확인이 완료되었습니다."
        : "이제 등록된 마스터 Google 계정으로 인증해 주세요.",
    );
    if (adminUser) {
      setMasterMode(true);
      setMasterGateOpen(false);
    }
  }

  async function handleAccessLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessPassword || accessBusy) return;

    setAccessBusy(true);
    setAccessError("");
    try {
      const { auth } = getFirebase();
      await setPersistence(auth, browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(
        auth,
        VIEWER_EMAIL,
        accessPassword,
      );
      if (!hasDashboardAccess(credential.user)) {
        await signOut(auth);
        throw new Error("access-denied");
      }
      setAccessPassword("");
    } catch {
      setAccessPassword("");
      setAccessError("비밀번호를 확인하고 다시 시도해 주세요.");
    } finally {
      setAccessBusy(false);
    }
  }

  async function handleAccessSignOut() {
    if (accessBusy) return;
    setAccessBusy(true);
    try {
      const { auth } = getFirebase();
      await signOut(auth);
      setMasterMode(false);
      setPinUnlocked(false);
      setRemoteMembers([]);
      setCompletions([]);
      setMembersLoaded(false);
      setCompletionsLoaded(false);
      setConnectionError("");
    } finally {
      setAccessBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!pinUnlocked) return;
    setBusyAction("signin");
    setGateMessage("");
    try {
      const { auth } = getFirebase();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      if (!isAuthorizedAdmin(result.user)) {
        await signOut(auth);
        setGateMessage(
          result.user.email?.toLowerCase() === ADMIN_EMAIL
            ? "이 Google 계정의 이메일 인증 상태를 확인해 주세요."
            : "등록된 마스터 계정만 관리 모드에 들어갈 수 있습니다.",
        );
        return;
      }
      setMasterMode(true);
      setMasterGateOpen(false);
      setPinUnlocked(false);
      setNotice("마스터 모드가 열렸습니다.");
    } catch {
      setGateMessage(
        "Google 인증을 완료하지 못했습니다. 팝업 허용 상태를 확인해 주세요.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function handleSignOut() {
    const { auth } = getFirebase();
    await signOut(auth);
    setMasterMode(false);
    setPinUnlocked(false);
    setNotice("조회 전용 모드로 전환되었습니다.");
  }

  async function addMember() {
    const name = newMemberName.trim();
    if (!canManage || !user || !name || name.length > 30) return;

    setBusyAction("add-member");
    setNotice("");
    try {
      const { db } = getFirebase();
      const id = makeMemberId();
      const now = serverTimestamp();
      await setDoc(doc(db, "members", id), {
        id,
        name,
        leaderId: newMemberLeader,
        registeredAt: now,
        createdAt: now,
        updatedAt: now,
        active: true,
      });
      setNewMemberName("");
      setSelectedMemberId(id);
      setSelectedLeaderId(newMemberLeader);
      setOpenStage(1);
      setNotice(`${name}을(를) ${leaderName(newMemberLeader)}에 등록했습니다.`);
    } catch {
      setNotice("새성도 등록에 실패했습니다. 관리자 권한을 확인해 주세요.");
    } finally {
      setBusyAction("");
    }
  }

  async function reassignMember(memberId: string, leaderId: string) {
    if (!canManage) return;
    setBusyAction(`leader-${memberId}`);
    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, "members", memberId), {
        leaderId,
        updatedAt: serverTimestamp(),
      });
      setNotice(`소속 구역을 ${leaderName(leaderId)}으로 변경했습니다.`);
    } catch {
      setNotice("소속 구역 변경에 실패했습니다.");
    } finally {
      setBusyAction("");
    }
  }

  async function removeMember(member: Member) {
    if (!canManage || member.isFallback) return;
    const approved = window.confirm(
      `${member.name}과(와) 모든 진도 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!approved) return;

    setBusyAction(`delete-${member.id}`);
    try {
      const { db } = getFirebase();
      const batch = writeBatch(db);
      for (const completion of completions) {
        if (completion.memberId === member.id) {
          batch.delete(doc(db, "completions", completion.id));
        }
      }
      batch.delete(doc(db, "members", member.id));
      await batch.commit();
      setNotice(`${member.name}과(와) 연결된 진도 기록을 삭제했습니다.`);
    } catch {
      setNotice("성도 삭제에 실패했습니다.");
    } finally {
      setBusyAction("");
    }
  }

  async function toggleCompletion(
    stage: CurriculumStage,
    item: CurriculumItem,
  ) {
    if (!canManage || !selectedMember || selectedMember.isFallback || !user) {
      return;
    }

    const completionId = `${selectedMember.id}__${item.id}`;
    const existing = selectedCompletions.get(item.id);
    setBusyAction(completionId);
    try {
      const { db } = getFirebase();
      const completionRef = doc(db, "completions", completionId);
      if (existing) {
        await deleteDoc(completionRef);
        setNotice(`${item.title} 완료 표시를 해제했습니다.`);
      } else {
        await setDoc(completionRef, {
          memberId: selectedMember.id,
          itemId: item.id,
          course: 1,
          completedAt: serverTimestamp(),
        });
        const completedInStage = stage.items.filter((stageItem) =>
          selectedCompletions.has(stageItem.id),
        ).length;
        setNotice(
          completedInStage + 1 === stage.items.length
            ? `축하합니다! ${stage.id}단계를 모두 완료했습니다.`
            : `${item.title} 학습을 완료했습니다.`,
        );
      }
    } catch {
      setNotice("진도 저장에 실패했습니다. 관리자 권한을 확인해 주세요.");
    } finally {
      setBusyAction("");
    }
  }

  function changePin() {
    const storedPin =
      window.localStorage.getItem(PIN_STORAGE_KEY) ?? DEFAULT_PIN;
    if (currentPin !== storedPin) {
      setPinChangeMessage("현재 PIN이 맞지 않습니다.");
      return;
    }
    if (!/^\d{4,}$/.test(nextPin)) {
      setPinChangeMessage("새 PIN은 숫자 4자리 이상으로 입력해 주세요.");
      return;
    }
    if (nextPin !== confirmPin) {
      setPinChangeMessage("새 PIN 확인 값이 일치하지 않습니다.");
      return;
    }
    window.localStorage.setItem(PIN_STORAGE_KEY, nextPin);
    setCurrentPin("");
    setNextPin("");
    setConfirmPin("");
    setPinChangeMessage("화면 잠금 PIN이 변경되었습니다.");
  }

  const loading = !membersLoaded || !completionsLoaded;

  if (!authResolved) {
    return (
      <main className={`didimdol-app${darkMode ? " is-dark" : ""}`}>
        <section className="access-gate" aria-live="polite" aria-busy="true">
          <div className="access-card access-loading-card">
            <div className="access-logo" aria-hidden="true">
              🏫
            </div>
            <p className="access-kicker">새성도스쿨 디딤돌</p>
            <h1>안전한 접속 상태를 확인하고 있습니다</h1>
            <div className="access-spinner" aria-hidden="true" />
            <p className="access-description">잠시만 기다려 주세요.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={`didimdol-app${darkMode ? " is-dark" : ""}`}>
        <section className="access-gate" aria-labelledby="access-title">
          <div className="access-card">
            <div className="access-brand">
              <div className="access-logo" aria-hidden="true">
                🏫
              </div>
              <p className="access-kicker">새성도스쿨 디딤돌</p>
              <h1 id="access-title">믿음의 여정에 함께해요</h1>
              <p className="access-description">
                구성원의 소중한 학습 기록을 보호하기 위해 접속 비밀번호를
                확인합니다.
              </p>
            </div>
            <form className="access-form" onSubmit={handleAccessLogin}>
              <label htmlFor="access-password">접속 비밀번호</label>
              <input
                id="access-password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={accessPassword}
                onChange={(event) => setAccessPassword(event.target.value)}
                aria-describedby="access-error access-privacy"
              />
              <button type="submit" disabled={accessBusy || !accessPassword}>
                {accessBusy ? "확인 중…" : "대시보드 접속"}
              </button>
              <p
                id="access-error"
                className={`access-error${accessError ? " is-visible" : ""}`}
                role="alert"
              >
                {accessError}
              </p>
            </form>
            <p className="access-privacy" id="access-privacy">
              비밀번호는 저장되지 않으며 브라우저를 닫으면 접속이 종료됩니다.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`didimdol-app${darkMode ? " is-dark" : ""}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="school-logo"
            onDoubleClick={openMasterGate}
            onPointerUp={(event) => handleLogoTouch(event.pointerType)}
            aria-label="새성도스쿨 홈"
            title="새성도스쿨 디딤돌"
          >
            <span aria-hidden="true">🏫</span>
          </button>
          <div className="brand-copy">
            <strong>새성도스쿨 디딤돌</strong>
            <span>함께 배우고, 함께 성장하는 믿음의 여정</span>
          </div>

          <div className="topbar-actions">
            <label className="member-picker leader-picker">
              <span>구역 선택</span>
              <select
                aria-label="구역 선택"
                value={selectedLeaderId}
                onChange={(event) => setSelectedLeaderId(event.target.value)}
              >
                <option value="all">전체 구역</option>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.id === "unassigned" ? "미편성" : leader.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              onClick={() => setDarkMode((current) => !current)}
              aria-label={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              <span aria-hidden="true">{darkMode ? "☀️" : "🌙"}</span>
            </button>
            <button
              type="button"
              className="access-exit-button"
              onClick={handleAccessSignOut}
              disabled={accessBusy}
            >
              접속 종료
            </button>
            {masterMode && (
              <button
                type="button"
                className="lock-button"
                onClick={() => {
                  setMasterMode(false);
                  setPinUnlocked(false);
                  setNotice("조회 전용 모드로 잠겼습니다.");
                }}
              >
                🔒 마스터 모드 종료
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="page-shell">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">지역장 {regionLeader} · 새성도스쿨 1과정</p>
            <h1 id="page-title">우리의 성장을 한눈에 확인해요</h1>
            <p>
              각 구역이 함께 배우며 쌓아 온 오늘의 진도를 실시간으로
              나눕니다.
            </p>
          </div>
          <div className="live-state" aria-live="polite">
            <span
              className={`live-dot${connectionError ? " has-error" : ""}`}
              aria-hidden="true"
            />
            {loading
              ? "공유 현황 연결 중"
              : connectionError || "실시간 공유 중"}
          </div>
        </section>

        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="알림 닫기"
            >
              ×
            </button>
          </div>
        )}

        <section className="hero-grid">
          <article className="journey-card">
            <div className="journey-copy">
              <p>선택된 믿음의 여정</p>
              <h2>{selectedMember?.name ?? "진도를 불러오는 중입니다"}</h2>
              <div className="stage-chip">
                {selectedProgress?.allComplete
                  ? "12단계 완료"
                  : `${selectedProgress?.currentStage ?? 1}단계 진행 중`}
              </div>
            </div>
            <div
              className="journey-progress"
              role="img"
              aria-label={`전체 진도 ${selectedProgress?.percent ?? 0}%`}
            >
              <div
                className="progress-ring"
                style={{
                  background: `conic-gradient(#f3c872 0 ${selectedProgress?.percent ?? 0}%, rgba(255,255,255,.18) ${selectedProgress?.percent ?? 0}% 100%)`,
                }}
              >
                <span>{selectedProgress?.percent ?? 0}%</span>
                <small>
                  {selectedProgress?.completed ?? 0}/{totalItems}
                </small>
              </div>
              <div className="progress-copy">
                <strong>새성도스쿨 1</strong>
                <div className="progress-track">
                  <i
                    style={{ width: `${selectedProgress?.percent ?? 0}%` }}
                  />
                </div>
                <span>완료한 세부 항목이 모두의 현황에 바로 반영됩니다.</span>
              </div>
            </div>
          </article>

          <article className="motivation-card">
            <span className="quote-mark" aria-hidden="true">
              “
            </span>
            <p>오늘의 한 항목이 내일의 단단한 믿음이 됩니다.</p>
            <strong>서로 응원하며 끝까지 완주해요</strong>
            <div className="tiny-stars" aria-hidden="true">
              ✦ ✦ ✦
            </div>
          </article>
        </section>

        <section className="section-block zone-section" aria-labelledby="zone-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">구역별 팀 현황</p>
              <h2 id="zone-title">함께 달리는 우리 구역</h2>
            </div>
            <p>구역원 수와 평균 진도를 기준으로 표시됩니다.</p>
          </div>
          <div className="zone-grid">
            {zoneSummaries.map(({ leader, people, average, completed }) => (
              <article className="zone-card" key={leader.id}>
                <div className="zone-card-head">
                  <span className="leader-avatar">
                    {leader.id === "unassigned" ? "–" : getInitial(leader.name)}
                  </span>
                  <div>
                    <strong>
                      {leader.id === "unassigned" ? "미편성" : leader.name}
                    </strong>
                    <span>{people.length}명 함께 학습 중</span>
                  </div>
                  <b>{average}%</b>
                </div>
                <div
                  className="zone-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={average}
                  aria-label={`${leader.name} 평균 진도`}
                >
                  <i style={{ width: `${average}%` }} />
                </div>
                <small>구역 누적 완료 {completed}개</small>
              </article>
            ))}
          </div>
        </section>

        <section
          className="section-block leaderboard-section"
          aria-labelledby="leaderboard-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">믿음 성장 리더보드</p>
              <h2 id="leaderboard-title">
                {selectedZoneLabel} · 이번 주 한 걸음 앞선 주인공
              </h2>
            </div>
            <p>
              {selectedZoneLabel} 진도를 높은 순서로 표시합니다. 동점이면
              이름순이며, 서로 따뜻하게 응원해 주세요.
            </p>
          </div>

          <div className="leaderboard-wrap">
            <table className="leaderboard">
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">성도</th>
                  <th scope="col">소속 구역</th>
                  <th scope="col">현재 단계</th>
                  <th scope="col">완료</th>
                  <th scope="col">전체 진도</th>
                  <th scope="col">
                    <span className="sr-only">상세 조회</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      리더보드를 불러오고 있습니다.
                    </td>
                  </tr>
                )}
                {!loading && visibleLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      이 구역에는 등록된 새성도가 없습니다.
                    </td>
                  </tr>
                )}
                {!loading &&
                  visibleLeaderboard.map((entry, index) => (
                    <tr
                      key={entry.member.id}
                      className={`${index < 3 ? `top-rank rank-${index + 1}` : ""}${
                        entry.member.id === selectedMember?.id
                          ? " is-selected"
                          : ""
                      }`}
                    >
                      <td>
                        <span className="rank-badge">
                          {index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}
                        </span>
                      </td>
                      <td>
                        <div className="member-cell">
                          <span>{getInitial(entry.member.name)}</span>
                          <strong>{entry.member.name}</strong>
                        </div>
                      </td>
                      <td>{leaderName(entry.member.leaderId)}</td>
                      <td>
                        <span className="stage-label">
                          {entry.allComplete
                            ? "12단계 완료"
                            : `${entry.currentStage}단계 진행 중`}
                        </span>
                      </td>
                      <td>
                        <strong>{entry.completed}</strong>/{totalItems}
                      </td>
                      <td>
                        <div className="table-progress">
                          <div>
                            <i style={{ width: `${entry.percent}%` }} />
                          </div>
                          <strong>{entry.percent}%</strong>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setSelectedMemberId(entry.member.id);
                            document
                              .getElementById("curriculum-title")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        >
                          진도 보기
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {masterMode && (
          <section
            className="section-block master-panel"
            aria-labelledby="master-panel-title"
          >
            <div className="master-panel-heading">
              <div>
                <span className="master-badge">MASTER</span>
                <h2 id="master-panel-title">새성도 및 구역 편성 관리</h2>
                <p>구역별 새성도를 등록하고 소속 구역을 바로 조정할 수 있습니다.</p>
              </div>
              <div className="master-account">
                <span>인증된 마스터</span>
                <strong>마스터</strong>
                <button type="button" onClick={handleSignOut}>
                  Google 로그아웃
                </button>
              </div>
            </div>

            {remoteMembers.length === 0 && (
              <div className="seed-banner">
                <div>
                  <strong>공유 명단이 아직 비어 있습니다.</strong>
                  <span>아래 등록 양식에서 첫 새성도를 추가해 주세요.</span>
                </div>
              </div>
            )}

            <div className="add-member-form">
              <p className="consent-note">
                이름·구역·진도·완료 시각이 구성원에게 공유됩니다. 공개 동의를
                확인한 뒤 등록하세요.
              </p>
              <label>
                <span>새성도 이름</span>
                <input
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addMember();
                  }}
                  maxLength={30}
                  placeholder="예: 홍길동 형제님"
                />
              </label>
              <label>
                <span>소속 구역</span>
                <select
                  value={newMemberLeader}
                  onChange={(event) => setNewMemberLeader(event.target.value)}
                >
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="primary-button"
                onClick={addMember}
                disabled={
                  !newMemberName.trim() || busyAction === "add-member"
                }
              >
                {busyAction === "add-member" ? "등록 중…" : "새성도 등록"}
              </button>
            </div>

            <div className="member-admin-list">
              {remoteMembers.map((member) => (
                <div className="member-admin-row" key={member.id}>
                  <div className="member-admin-name">
                    <span>{getInitial(member.name)}</span>
                    <div>
                      <strong>{member.name}</strong>
                      <small>등록 {formatDate(member.registeredAt)}</small>
                    </div>
                  </div>
                  <label>
                    <span className="sr-only">{member.name} 소속 구역</span>
                    <select
                      value={member.leaderId}
                      onChange={(event) =>
                        reassignMember(member.id, event.target.value)
                      }
                      disabled={busyAction === `leader-${member.id}`}
                    >
                      {leaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="view-member-button"
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    진도 관리
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => removeMember(member)}
                    disabled={busyAction === `delete-${member.id}`}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <details className="security-settings">
              <summary>마스터 보안 설정</summary>
              <p>이 기기의 숨겨진 화면 잠금 PIN만 변경합니다.</p>
              <button
                type="button"
                onClick={() => {
                  setPinChangeOpen(true);
                  setPinChangeMessage("");
                }}
              >
                화면 잠금 PIN 변경
              </button>
            </details>
          </section>
        )}

        <section
          className="section-block curriculum-section"
          aria-labelledby="curriculum-title"
        >
          <div className="section-heading curriculum-heading">
            <div>
              <p className="eyebrow">개별 학습 체크</p>
              <h2 id="curriculum-title">
                {selectedMember?.name ?? "선택된 성도"} · 새성도스쿨 1
              </h2>
              <p>
                {canManage
                  ? "각 항목을 완료한 날이 자동으로 기록됩니다."
                  : "진도는 조회 전용입니다. 체크는 인증된 마스터만 할 수 있습니다."}
              </p>
            </div>
            <div className="curriculum-total">
              <span>전체 완료</span>
              <strong>
                {selectedProgress?.completed ?? 0}
                <small>/{totalItems}</small>
              </strong>
            </div>
          </div>

          {isFallbackOnly && masterMode && (
            <div className="inline-info">
              먼저 위 관리 영역에서 새성도를 등록하면 진도를 체크할 수 있습니다.
            </div>
          )}

          <div className="stage-list">
            {curriculum.map((stage) => {
              const stageCompleted = stage.items.filter((item) =>
                selectedCompletions.has(item.id),
              ).length;
              const stagePercent = stage.items.length
                ? Math.round((stageCompleted / stage.items.length) * 100)
                : 0;
              const expanded = openStage === stage.id;

              return (
                <article
                  className={`stage-card${
                    stageCompleted === stage.items.length
                      ? " is-complete"
                      : ""
                  }`}
                  key={stage.id}
                >
                  <button
                    type="button"
                    className="stage-toggle"
                    onClick={() => setOpenStage(expanded ? null : stage.id)}
                    aria-expanded={expanded}
                    aria-controls={`stage-${stage.id}-items`}
                  >
                    <span className="stage-number">
                      {stageCompleted === stage.items.length ? "✓" : stage.id}
                    </span>
                    <span className="stage-title">
                      <strong>{stage.title}</strong>
                      <small>
                        {stageCompleted}/{stage.items.length}개 완료
                      </small>
                    </span>
                    <span className="stage-mini-progress" aria-hidden="true">
                      <i style={{ width: `${stagePercent}%` }} />
                    </span>
                    <b>{stagePercent}%</b>
                    <span className="chevron" aria-hidden="true">
                      {expanded ? "−" : "+"}
                    </span>
                  </button>

                  {expanded && (
                    <div
                      className="stage-items"
                      id={`stage-${stage.id}-items`}
                    >
                      {stage.items.map((item) => {
                        const completion = selectedCompletions.get(item.id);
                        const completionId = `${selectedMember?.id ?? ""}__${item.id}`;
                        return (
                          <label
                            className={`curriculum-item${
                              completion ? " is-checked" : ""
                            }`}
                            key={item.id}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(completion)}
                              disabled={
                                !canManage ||
                                isFallbackOnly ||
                                busyAction === completionId
                              }
                              onChange={() => toggleCompletion(stage, item)}
                            />
                            <span className="custom-check" aria-hidden="true">
                              {completion ? "✓" : ""}
                            </span>
                            <span className="item-copy">
                              <strong>{item.title}</strong>
                              <small>
                                {completion
                                  ? `${formatDate(
                                      completion.completedAt,
                                      true,
                                    )} 완료 · 마스터 기록`
                                  : "아직 완료 기록이 없습니다."}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {masterGateOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-gate-title"
        >
          <div className="modal-card">
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                setMasterGateOpen(false);
                setPinUnlocked(false);
              }}
              aria-label="마스터 인증 창 닫기"
            >
              ×
            </button>
            <div className="modal-icon" aria-hidden="true">
              {pinUnlocked ? "🔐" : "🏫"}
            </div>
            <h2 id="master-gate-title">
              {pinUnlocked ? "마스터 Google 인증" : "화면 잠금 해제"}
            </h2>
            <p>
              {pinUnlocked
                ? "등록된 마스터 계정으로 한 번 더 안전하게 확인합니다."
                : "이 기기에 설정된 화면 잠금 PIN을 입력해 주세요."}
            </p>

            {!pinUnlocked ? (
              <>
                <label className="modal-field">
                  <span>화면 잠금 PIN</span>
                  <input
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    value={pinEntry}
                    onChange={(event) =>
                      setPinEntry(event.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") unlockPin();
                    }}
                    aria-describedby="gate-message"
                  />
                </label>
                <button
                  type="button"
                  className="primary-button wide-button"
                  onClick={unlockPin}
                  disabled={!pinEntry}
                >
                  PIN 확인
                </button>
              </>
            ) : (
              <button
                type="button"
                className="google-button"
                onClick={handleGoogleSignIn}
                disabled={busyAction === "signin"}
              >
                <span aria-hidden="true">G</span>
                {busyAction === "signin"
                  ? "Google 인증 중…"
                  : "Google 계정으로 계속"}
              </button>
            )}
            <div
              className={`gate-message${gateMessage ? " is-visible" : ""}`}
              id="gate-message"
              role="status"
            >
              {gateMessage}
            </div>
          </div>
        </div>
      )}

      {pinChangeOpen && masterMode && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-change-title"
        >
          <div className="modal-card">
            <button
              type="button"
              className="modal-close"
              onClick={() => setPinChangeOpen(false)}
              aria-label="PIN 변경 창 닫기"
            >
              ×
            </button>
            <div className="modal-icon" aria-hidden="true">
              🔑
            </div>
            <h2 id="pin-change-title">화면 잠금 PIN 변경</h2>
            <p>이 브라우저에서만 사용하는 숫자 PIN입니다.</p>
            <label className="modal-field">
              <span>현재 PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(event) =>
                  setCurrentPin(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <label className="modal-field">
              <span>새 PIN · 숫자 4자리 이상</span>
              <input
                type="password"
                inputMode="numeric"
                value={nextPin}
                onChange={(event) =>
                  setNextPin(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <label className="modal-field">
              <span>새 PIN 확인</span>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(event) =>
                  setConfirmPin(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <button
              type="button"
              className="primary-button wide-button"
              onClick={changePin}
            >
              PIN 변경
            </button>
            <div
              className={`gate-message${pinChangeMessage ? " is-visible" : ""}`}
              role="status"
            >
              {pinChangeMessage}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
