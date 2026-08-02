import {
  regionLeader,
  school1Curriculum,
  school1TotalItems,
  zoneLeaders,
} from "./curriculum.js";
import {
  addMember,
  changeMemberLeader,
  hasDashboardAccess,
  isAdminUser,
  removeMember,
  setItemCompletion,
  signInMaster,
  signInViewer,
  signOutMaster,
  signOutViewer,
  subscribeAuth,
  subscribeSharedData,
} from "./firebase-sync.js";

const DEFAULT_PIN = "1925";
const PIN_KEY = "didimdol-screen-lock-pin";
const THEME_KEY = "didimdol-theme";
const SEOUL_TIME_ZONE = "Asia/Seoul";
const SEOUL_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const SEOUL_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const curriculumItemsById = new Map(
  school1Curriculum.flatMap((stage) =>
    stage.items.map((item) => [
      item.id,
      { stageId: stage.id, stageTitle: stage.title, itemTitle: item.title },
    ]),
  ),
);
const fallbackMember = {
  id: "empty-member",
  name: "등록된 새성도 없음",
  leaderId: "unassigned",
  registeredAt: null,
  active: true,
  isFallback: true,
};

const state = {
  remoteMembers: [],
  completions: [],
  membersLoaded: false,
  completionsLoaded: false,
  selectedMemberId: fallbackMember.id,
  selectedLeaderId: "all",
  registrationLeaderId: zoneLeaders[0]?.id ?? "unassigned",
  user: null,
  authReady: false,
  accessBusy: false,
  accessMessage: "",
  masterMode: false,
  gateOpen: false,
  gateStep: "pin",
  gateMessage: "",
  pinChangeOpen: false,
  notice: "",
  connectionError: "",
  openStage: 1,
  busy: "",
  dark:
    localStorage.getItem(THEME_KEY) === "dark" ||
    (!localStorage.getItem(THEME_KEY) &&
      matchMedia("(prefers-color-scheme: dark)").matches),
};

let touchCount = 0;
let touchTimer = 0;
let stopSharedData = null;
const root = document.querySelector("#root");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, includeTime = false) {
  const date = toDate(value);
  if (!date) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function seoulDateKey(value) {
  const date = toDate(value);
  if (!date) return "";
  const parts = SEOUL_DATE_KEY_FORMATTER.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatSeoulTime(value) {
  const date = toDate(value);
  if (!date) return "시간 확인 중";
  return SEOUL_TIME_FORMATTER.format(date);
}

let currentSeoulDateKey = seoulDateKey(new Date());

function todayStudyMap() {
  const result = new Map();
  state.completions.forEach((completion) => {
    if (seoulDateKey(completion.completedAt) !== currentSeoulDateKey) return;
    const curriculumItem = curriculumItemsById.get(completion.itemId);
    if (!curriculumItem) return;
    const records = result.get(completion.memberId) ?? [];
    records.push({
      ...completion,
      ...curriculumItem,
      completedDate: toDate(completion.completedAt),
    });
    result.set(completion.memberId, records);
  });
  result.forEach((records) => {
    records.sort(
      (a, b) => (b.completedDate?.getTime() ?? 0) - (a.completedDate?.getTime() ?? 0),
    );
  });
  return result;
}

function leaderName(id) {
  return zoneLeaders.find((leader) => leader.id === id)?.name ?? "미편성";
}

function initial(name) {
  return name.replace(/\s*(형제님|자매님)\s*$/, "").trim().slice(0, 1) || "새";
}

function members() {
  if (!state.membersLoaded) return [];
  return state.remoteMembers.length ? state.remoteMembers : [fallbackMember];
}

function completionMap(memberId) {
  return new Map(
    state.completions
      .filter((completion) => completion.memberId === memberId)
      .map((completion) => [completion.itemId, completion]),
  );
}

function progressFor(member) {
  const map = completionMap(member.id);
  const completed = school1Curriculum.reduce(
    (total, stage) =>
      total + stage.items.filter((item) => map.has(item.id)).length,
    0,
  );
  const firstIncomplete = school1Curriculum.find((stage) =>
    stage.items.some((item) => !map.has(item.id)),
  );
  return {
    member,
    completed,
    percent: Math.round((completed / school1TotalItems) * 100),
    currentStage: firstIncomplete?.id ?? 12,
    allComplete: completed === school1TotalItems,
  };
}

function selectedMember() {
  const list = members();
  return (
    list.find((member) => member.id === state.selectedMemberId) ??
    list[0] ??
    null
  );
}

function leaderboard() {
  return members()
    .map(progressFor)
    .sort(
      (a, b) =>
        b.completed - a.completed ||
        a.member.name.localeCompare(b.member.name, "ko"),
    );
}

function zoneSummaries(todayByMember = new Map()) {
  const ranking = leaderboard();
  return zoneLeaders.map((leader) => {
    const people = ranking.filter(
      (entry) => entry.member.leaderId === leader.id,
    );
    const average = people.length
      ? Math.round(
          people.reduce((sum, entry) => sum + entry.percent, 0) / people.length,
        )
      : 0;
    const todayCompleted = people.reduce(
      (total, entry) => total + (todayByMember.get(entry.member.id)?.length ?? 0),
      0,
    );
    return { leader, people, average, todayCompleted };
  });
}

function stageLabel(entry) {
  return entry.allComplete
    ? "12단계 완료"
    : `${entry.currentStage}단계 진행 중`;
}

function setNotice(message) {
  state.notice = message;
  render();
}

async function runBusy(key, operation, successMessage) {
  if (state.busy) return;
  state.busy = key;
  state.notice = "";
  render();
  try {
    await operation();
    state.notice = successMessage;
  } catch (error) {
    state.notice =
      error?.message || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    state.busy = "";
    render();
  }
}

function openMasterGate() {
  state.gateOpen = true;
  state.gateStep = "pin";
  state.gateMessage = "";
  render();
  setTimeout(() => document.querySelector("#pinEntry")?.focus(), 0);
}

function render() {
  document.documentElement.dataset.theme = state.dark ? "dark" : "light";

  if (!state.authReady) {
    root.innerHTML = `
      <main class="access-gate" aria-live="polite">
        <section class="access-card access-loading" role="status">
          <span class="access-logo">🏫</span>
          <h1>새성도스쿨 디딤돌</h1>
          <p>안전한 접속 상태를 확인하고 있습니다.</p>
          <i class="access-spinner" aria-hidden="true"></i>
        </section>
      </main>`;
    return;
  }

  if (!state.user) {
    root.innerHTML = `
      <main class="access-gate">
        <section class="access-card" aria-labelledby="accessTitle">
          <span class="access-logo">🏫</span>
          <p class="eyebrow">새성도스쿨 1과정</p>
          <h1 id="accessTitle">디딤돌에 접속하기</h1>
          <p class="access-copy">공유된 진도는 구성원만 확인할 수 있습니다.<br />접속 비밀번호를 입력해 주세요.</p>
          <form class="access-form" id="viewerLoginForm">
            <label for="viewerPassword">접속 비밀번호</label>
            <input id="viewerPassword" type="password" autocomplete="current-password" placeholder="비밀번호" required autofocus />
            <button class="primary-button" type="submit" ${state.accessBusy ? "disabled" : ""}>${
              state.accessBusy ? "확인 중…" : "접속하기"
            }</button>
          </form>
          <small class="access-message" role="alert">${escapeHtml(state.accessMessage)}</small>
          <small class="access-privacy">비밀번호는 저장되지 않으며 브라우저를 닫으면 접속이 종료됩니다.</small>
        </section>
      </main>`;
    document.querySelector("#viewerLoginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.accessBusy) return;
      const password = document.querySelector("#viewerPassword").value;
      state.accessBusy = true;
      state.accessMessage = "";
      render();
      try {
        await signInViewer(password);
      } catch {
        state.accessMessage = "접속 비밀번호를 다시 확인해 주세요.";
      } finally {
        state.accessBusy = false;
        render();
      }
    });
    return;
  }

  const list = members();
  if (list.length && !list.some((member) => member.id === state.selectedMemberId)) {
    state.selectedMemberId = list[0].id;
  }
  const selected = selectedMember();
  const selectedProgress = selected ? progressFor(selected) : null;
  const selectedCompletions = selected ? completionMap(selected.id) : new Map();
  const ranking = leaderboard();
  const todayByMember = todayStudyMap();
  const selectedTodayStudy = selected ? todayByMember.get(selected.id) ?? [] : [];
  const visibleRanking =
    state.selectedLeaderId === "all"
      ? ranking
      : ranking.filter(
          (entry) => entry.member.leaderId === state.selectedLeaderId,
        );
  const selectedLeaderLabel =
    state.selectedLeaderId === "all"
      ? "전체 구역"
      : state.selectedLeaderId === "unassigned"
        ? "미편성"
        : leaderName(state.selectedLeaderId);
  const canManage = state.masterMode && isAdminUser(state.user);
  const loading = !state.membersLoaded || !state.completionsLoaded;

  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <button class="school-logo" id="schoolLogo" type="button" aria-label="마스터 모드 열기">🏫</button>
        <div class="brand">
          <strong>새성도스쿨 디딤돌</strong>
          <small>지역장 ${escapeHtml(regionLeader)} · 새성도스쿨 1과정</small>
        </div>
        <span class="sync-state ${state.connectionError ? "error" : ""}">
          <i></i>${loading ? "공유 현황 연결 중" : state.connectionError || "실시간 공유 중"}
        </span>
        <label class="member-picker">
          <span>구역 선택</span>
          <select id="leaderPicker">
            <option value="all" ${state.selectedLeaderId === "all" ? "selected" : ""}>전체 구역</option>
            ${zoneLeaders
              .map(
                (leader) =>
                  `<option value="${leader.id}" ${
                    state.selectedLeaderId === leader.id ? "selected" : ""
                  }>${
                    leader.id === "unassigned"
                      ? "미편성"
                      : escapeHtml(leader.name)
                  }</option>`,
              )
              .join("")}
          </select>
        </label>
        <button class="icon-button" id="themeButton" type="button" aria-label="테마 전환">${
          state.dark ? "☀️" : "🌙"
        }</button>
        <button class="access-exit-button" id="accessExit" type="button">접속 종료</button>
        ${
          state.masterMode
            ? '<button class="lock-button" id="masterExit" type="button">🔒 마스터 모드 종료</button>'
            : ""
        }
      </div>
    </header>

    <main class="page-shell">
      <section class="page-intro">
        <div>
          <p class="eyebrow">함께 걷는 믿음의 여정</p>
          <h1>구역별 성장과 진도를 한눈에 확인하세요</h1>
          <p>서로의 성장을 응원하며 새성도스쿨 1과정의 120개 디딤돌을 차근차근 완성합니다.</p>
        </div>
        <span class="mode-pill ${state.masterMode ? "master" : ""}">
          ${state.masterMode ? "마스터 모드 · 수정 가능" : "일반 사용자 모드 · 조회 전용"}
        </span>
      </section>

      ${
        state.notice
          ? `<div class="notice" role="status"><span>${escapeHtml(
              state.notice,
            )}</span><button id="noticeClose" type="button" aria-label="알림 닫기">×</button></div>`
          : ""
      }

      <section class="hero-grid">
        <article class="journey-card">
          <div>
            <p>선택한 성도의 믿음 여정</p>
            <h2>${escapeHtml(selected?.name ?? "진도를 불러오는 중")}</h2>
            <span class="stage-chip">${
              selectedProgress ? stageLabel(selectedProgress) : "연결 중"
            }</span>
          </div>
          <div class="journey-stats">
            <div class="ring" style="--progress:${selectedProgress?.percent ?? 0}">
              <strong>${selectedProgress?.percent ?? 0}%</strong>
              <small>${selectedProgress?.completed ?? 0}/${school1TotalItems}</small>
            </div>
            <div class="hero-progress">
              <strong>새성도스쿨 1</strong>
              <div class="progress-track"><i style="width:${selectedProgress?.percent ?? 0}%"></i></div>
              <small>완료한 개별 항목이 실시간으로 반영됩니다.</small>
            </div>
          </div>
        </article>
        <article class="motivation-card">
          <span>오늘의 응원</span>
          <blockquote>“작은 한 걸음이 믿음의 큰 성장을 만듭니다.”</blockquote>
          <p>서로 격려하며 끝까지 함께 걸어요.</p>
        </article>
      </section>

      <section class="section-block today-study-section">
        <div class="section-heading today-study-heading">
          <div><p class="eyebrow">오늘의 학습 기록</p><h2>${escapeHtml(
            selected?.name ?? "선택한 성도",
          )} · 오늘 공부한 내용</h2></div>
          <span class="today-total">${selectedTodayStudy.length}개 완료</span>
        </div>
        ${
          selectedTodayStudy.length
            ? `<div class="today-study-list">${selectedTodayStudy
                .map(
                  (record) => `<article class="today-study-item">
                    <span class="today-stage">${escapeHtml(record.stageTitle)}</span>
                    <strong>${escapeHtml(record.itemTitle)}</strong>
                    <time datetime="${escapeHtml(
                      record.completedDate?.toISOString() ?? "",
                    )}">${escapeHtml(formatSeoulTime(record.completedAt))}</time>
                  </article>`,
                )
                .join("")}</div>`
            : '<div class="today-empty"><span>☀️</span><p>오늘 완료한 과목이 아직 없습니다.</p></div>'
        }
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div><p class="eyebrow">구역별 한눈에 보기</p><h2>우리 구역 성장 현황</h2></div>
          <p>구역원의 평균 진도를 기준으로 표시합니다.</p>
        </div>
        <div class="zone-grid">
          ${zoneSummaries(todayByMember)
            .map(
              ({ leader, people, average, todayCompleted }) => `
                <article class="zone-card">
                  <div class="zone-head">
                    <span>${leader.id === "unassigned" ? "?" : escapeHtml(initial(leader.name))}</span>
                    <div><strong>${
                      leader.id === "unassigned"
                        ? "미편성"
                        : escapeHtml(leader.name)
                    }</strong><small>${people.length}명 학습 중 · 오늘 ${todayCompleted}개 완료</small></div>
                    <b>${average}%</b>
                  </div>
                  <div class="progress-track"><i style="width:${average}%"></i></div>
                </article>`,
            )
            .join("")}
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div><p class="eyebrow">믿음 성장 리더보드</p><h2>${escapeHtml(
            selectedLeaderLabel,
          )} · 한 걸음 앞선 주인공</h2></div>
          <p>${escapeHtml(
            selectedLeaderLabel,
          )} 기준이며, 동점이면 이름순으로 표시합니다.</p>
        </div>
        <div class="table-wrap">
          <table class="leaderboard">
            <thead><tr><th>순위</th><th>성도</th><th>소속 구역</th><th>현재 단계</th><th>오늘 학습</th><th>완료</th><th>전체 진도</th><th></th></tr></thead>
            <tbody>
              ${
                loading
                  ? '<tr><td colspan="8" class="empty-cell">리더보드를 불러오고 있습니다.</td></tr>'
                  : visibleRanking.length
                    ? visibleRanking
                        .map(
                          (entry, index) => `
                          <tr class="${
                            index < 3 ? `top-rank rank-${index + 1}` : ""
                          } ${entry.member.id === selected?.id ? "selected" : ""}">
                            <td><span class="rank-badge">${
                              index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1
                            }</span></td>
                            <td><span class="avatar">${escapeHtml(
                              initial(entry.member.name),
                            )}</span><strong>${escapeHtml(entry.member.name)}</strong></td>
                            <td>${escapeHtml(leaderName(entry.member.leaderId))}</td>
                            <td><span class="stage-label">${stageLabel(entry)}</span></td>
                            <td class="today-learning"><strong>${
                              todayByMember.get(entry.member.id)?.length ?? 0
                            }개</strong><small>${escapeHtml(
                              todayByMember.get(entry.member.id)?.[0]?.itemTitle ??
                                "오늘 기록 없음",
                            )}</small></td>
                            <td><strong>${entry.completed}</strong>/${school1TotalItems}</td>
                            <td><div class="table-progress"><i style="width:${
                              entry.percent
                            }%"></i></div><small>${entry.percent}%</small></td>
                            <td><button class="view-button" data-view-member="${escapeHtml(
                              entry.member.id,
                            )}" type="button">조회</button></td>
                          </tr>`,
                        )
                        .join("")
                    : '<tr><td colspan="8" class="empty-cell">이 구역에는 등록된 새성도가 없습니다.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>

      ${
        state.masterMode
          ? `<section class="section-block master-panel">
              <div class="section-heading">
                <div><span class="master-badge">MASTER</span><h2>새성도 및 구역 편성 관리</h2></div>
                <button class="text-button" id="googleSignOut" type="button">Google 로그아웃</button>
              </div>
              ${
                state.remoteMembers.length === 0
                  ? '<div class="seed-banner"><div><strong>공유 명단이 비어 있습니다.</strong><span>아래 등록 양식에서 첫 새성도를 추가해 주세요.</span></div></div>'
                  : ""
              }
              <p class="consent-note"><strong id="registrationZoneLabel">등록 구역: ${escapeHtml(
                leaderName(state.registrationLeaderId),
              )}</strong><br />이름·구역·진도·완료 시각이 구성원에게 공유됩니다. 공개 동의를 확인한 뒤 등록하세요.</p>
              <form class="add-member-form" id="addMemberForm">
                <label><span>새성도 이름</span><input id="newMemberName" maxlength="30" required placeholder="예: 홍길동 형제님" /></label>
                <label><span>소속 구역</span><select id="newMemberLeader">${zoneLeaders
                  .map(
                    (leader) =>
                      `<option value="${leader.id}" ${
                        state.registrationLeaderId === leader.id ? "selected" : ""
                      }>${escapeHtml(leader.name)}</option>`,
                  )
                  .join("")}</select></label>
                <button class="primary-button" type="submit" ${
                  state.busy ? "disabled" : ""
                }>새성도 등록</button>
              </form>
              <div class="member-admin-list">
                ${state.remoteMembers
                  .map(
                    (member) => `
                    <div class="member-admin-row">
                      <div><span class="avatar">${escapeHtml(initial(member.name))}</span><strong>${escapeHtml(
                        member.name,
                      )}</strong><small>등록 ${formatDate(member.registeredAt)}</small></div>
                      <select data-member-leader="${escapeHtml(member.id)}">${zoneLeaders
                        .map(
                          (leader) =>
                            `<option value="${leader.id}" ${
                              member.leaderId === leader.id ? "selected" : ""
                            }>${escapeHtml(leader.name)}</option>`,
                        )
                        .join("")}</select>
                      <button class="view-button" data-view-member="${escapeHtml(
                        member.id,
                      )}" type="button">진도 관리</button>
                      <button class="danger-button" data-delete-member="${escapeHtml(
                        member.id,
                      )}" type="button">삭제</button>
                    </div>`,
                  )
                  .join("")}
              </div>
              <details class="security-settings"><summary>마스터 보안 설정</summary><p>이 기기의 숨겨진 화면 잠금 PIN만 변경합니다.</p><button id="pinChangeOpen" type="button">화면 잠금 PIN 변경</button></details>
            </section>`
          : ""
      }

      <section class="section-block curriculum-section">
        <div class="section-heading">
          <div><p class="eyebrow">개별 학습 체크</p><h2>${escapeHtml(
            selected?.name ?? "선택한 성도",
          )} · 새성도스쿨 1</h2><p>${
            canManage
              ? "체크하면 완료 시각이 자동으로 기록됩니다."
              : "일반 사용자 모드에서는 진도만 조회할 수 있습니다."
          }</p></div>
          <div class="total-box"><span>전체 완료</span><strong>${
            selectedProgress?.completed ?? 0
          }<small>/${school1TotalItems}</small></strong></div>
        </div>
        ${
          selected?.isFallback && state.masterMode
            ? '<div class="inline-info">먼저 관리 영역에서 새성도를 등록하면 진도를 체크할 수 있습니다.</div>'
            : ""
        }
        <div class="stage-list">
          ${school1Curriculum
            .map((stage) => {
              const completed = stage.items.filter((item) =>
                selectedCompletions.has(item.id),
              ).length;
              const percent = Math.round((completed / stage.items.length) * 100);
              const expanded = state.openStage === stage.id;
              return `<article class="stage-card ${
                completed === stage.items.length ? "complete" : ""
              }">
                <button class="stage-toggle" data-stage="${stage.id}" type="button" aria-expanded="${expanded}">
                  <span class="stage-number">${
                    completed === stage.items.length ? "✓" : stage.id
                  }</span>
                  <span><strong>${escapeHtml(stage.title)}</strong><small>${completed}/${
                    stage.items.length
                  }개 완료</small></span>
                  <div class="stage-progress"><i style="width:${percent}%"></i></div>
                  <b>${percent}%</b><em>${expanded ? "−" : "+"}</em>
                </button>
                ${
                  expanded
                    ? `<div class="stage-items">${stage.items
                        .map((item) => {
                          const completion = selectedCompletions.get(item.id);
                          return `<label class="curriculum-item ${
                            completion ? "checked" : ""
                          }">
                            <input type="checkbox" data-item-id="${item.id}" ${
                              completion ? "checked" : ""
                            } ${
                              canManage && !selected?.isFallback ? "" : "disabled"
                            } />
                            <span class="checkmark">${completion ? "✓" : ""}</span>
                            <span><strong>${escapeHtml(item.title)}</strong><small>${
                              completion
                                ? `${formatDate(
                                    completion.completedAt,
                                    true,
                                  )} 완료 · 마스터 기록`
                                : "아직 완료 기록이 없습니다."
                            }</small></span>
                          </label>`;
                        })
                        .join("")}</div>`
                    : ""
                }
              </article>`;
            })
            .join("")}
        </div>
      </section>
    </main>

    <footer><strong>새성도스쿨 디딤돌</strong><span>구성원의 진도는 Firebase를 통해 실시간 공유됩니다.</span></footer>

    ${
      state.gateOpen
        ? `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gateTitle">
            <div class="modal-card">
              <button class="modal-close" id="gateClose" type="button" aria-label="닫기">×</button>
              <span class="modal-icon">${state.gateStep === "pin" ? "🏫" : "🔐"}</span>
              <h2 id="gateTitle">${
                state.gateStep === "pin" ? "화면 잠금 해제" : "마스터 Google 인증"
              }</h2>
              <p>${
                state.gateStep === "pin"
                  ? "이 기기에 설정된 화면 잠금 PIN을 입력하세요."
                  : "등록된 마스터 Google 계정으로 안전하게 확인합니다."
              }</p>
              ${
                state.gateStep === "pin"
                  ? '<form id="pinForm"><input id="pinEntry" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" required /><button class="primary-button" type="submit">PIN 확인</button></form>'
                  : `<button class="google-button" id="googleLogin" type="button" ${
                      state.busy ? "disabled" : ""
                    }>Google 계정으로 인증</button>`
              }
              <small class="gate-message">${escapeHtml(state.gateMessage)}</small>
            </div>
          </div>`
        : ""
    }

    ${
      state.pinChangeOpen && state.masterMode
        ? `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pinTitle">
            <div class="modal-card">
              <button class="modal-close" id="pinChangeClose" type="button" aria-label="닫기">×</button>
              <span class="modal-icon">⚙️</span><h2 id="pinTitle">화면 잠금 PIN 변경</h2>
              <p>이 브라우저에서만 사용하는 숫자 PIN입니다.</p>
              <form id="pinChangeForm">
                <input id="currentPin" type="password" inputmode="numeric" placeholder="현재 PIN" required />
                <input id="nextPin" type="password" inputmode="numeric" placeholder="새 PIN · 숫자 4자리 이상" required />
                <input id="confirmPin" type="password" inputmode="numeric" placeholder="새 PIN 확인" required />
                <button class="primary-button" type="submit">PIN 변경</button>
              </form>
              <small class="gate-message">${escapeHtml(state.gateMessage)}</small>
            </div>
          </div>`
        : ""
    }
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector("#themeButton")?.addEventListener("click", () => {
    state.dark = !state.dark;
    localStorage.setItem(THEME_KEY, state.dark ? "dark" : "light");
    render();
  });

  document.querySelector("#accessExit")?.addEventListener("click", async () => {
    if (state.busy) return;
    state.busy = "access-exit";
    try {
      await signOutViewer();
    } catch {
      state.notice = "접속을 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    } finally {
      state.busy = "";
      render();
    }
  });

  document.querySelector("#leaderPicker")?.addEventListener("change", (event) => {
    state.selectedLeaderId = event.target.value;
    if (state.selectedLeaderId !== "all") {
      state.registrationLeaderId = state.selectedLeaderId;
    }
    const firstMember =
      state.selectedLeaderId === "all"
        ? null
        : leaderboard().find(
            (entry) => entry.member.leaderId === state.selectedLeaderId,
          )?.member;
    if (firstMember) state.selectedMemberId = firstMember.id;
    state.openStage = 1;
    render();
  });

  document.querySelector("#newMemberLeader")?.addEventListener("change", (event) => {
    state.registrationLeaderId = event.target.value;
    const label = document.querySelector("#registrationZoneLabel");
    if (label) label.textContent = `등록 구역: ${leaderName(state.registrationLeaderId)}`;
  });

  const logo = document.querySelector("#schoolLogo");
  logo?.addEventListener("dblclick", openMasterGate);
  logo?.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    touchCount += 1;
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => {
      touchCount = 0;
    }, 1200);
    if (touchCount >= 5) {
      touchCount = 0;
      openMasterGate();
    }
  });

  document.querySelector("#masterExit")?.addEventListener("click", async () => {
    state.masterMode = false;
    state.notice = "일반 사용자 모드로 전환했습니다.";
    render();
  });

  document.querySelector("#googleSignOut")?.addEventListener("click", async () => {
    await signOutMaster();
    state.masterMode = false;
    state.notice = "Google 로그아웃을 완료했습니다.";
    render();
  });

  document.querySelector("#noticeClose")?.addEventListener("click", () => {
    state.notice = "";
    render();
  });

  document.querySelectorAll("[data-view-member]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMemberId = button.dataset.viewMember;
      state.openStage = 1;
      render();
      document.querySelector(".curriculum-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  document.querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const stage = Number(button.dataset.stage);
      state.openStage = state.openStage === stage ? null : stage;
      render();
    });
  });

  document.querySelectorAll("[data-item-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const member = selectedMember();
      if (!member || member.isFallback) return;
      runBusy(
        `${member.id}__${checkbox.dataset.itemId}`,
        () =>
          setItemCompletion(
            member.id,
            checkbox.dataset.itemId,
            checkbox.checked,
          ),
        checkbox.checked ? "완료 시각을 기록했습니다." : "완료 기록을 해제했습니다.",
      );
    });
  });

  document.querySelector("#addMemberForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#newMemberName").value.trim();
    const leaderId = document.querySelector("#newMemberLeader").value;
    if (!name || name.length > 30) return;
    state.registrationLeaderId = leaderId;
    runBusy(
      "add-member",
      async () => {
        const id = await addMember(name, leaderId);
        state.selectedMemberId = id;
        state.selectedLeaderId = leaderId;
      },
      `${name}을(를) ${leaderName(leaderId)}에 등록했습니다.`,
    );
  });

  document.querySelectorAll("[data-member-leader]").forEach((select) => {
    select.addEventListener("change", () => {
      runBusy(
        `leader-${select.dataset.memberLeader}`,
        () =>
          changeMemberLeader(select.dataset.memberLeader, select.value),
        `소속 구역을 ${leaderName(select.value)}으로 변경했습니다.`,
      );
    });
  });

  document.querySelectorAll("[data-delete-member]").forEach((button) => {
    button.addEventListener("click", () => {
      const memberId = button.dataset.deleteMember;
      const member = state.remoteMembers.find((entry) => entry.id === memberId);
      if (
        !member ||
        !confirm(
          `${member.name}과(와) 연결된 모든 진도 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
        )
      ) {
        return;
      }
      const completionIds = state.completions
        .filter((entry) => entry.memberId === memberId)
        .map((entry) => entry.id);
      runBusy(
        `delete-${memberId}`,
        () => removeMember(memberId, completionIds),
        `${member.name}과(와) 진도 기록을 삭제했습니다.`,
      );
    });
  });

  document.querySelector("#gateClose")?.addEventListener("click", () => {
    state.gateOpen = false;
    state.gateMessage = "";
    render();
  });

  document.querySelector("#pinForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const entered = document.querySelector("#pinEntry").value;
    const stored = localStorage.getItem(PIN_KEY) ?? DEFAULT_PIN;
    if (entered !== stored) {
      state.gateMessage = "화면 잠금 PIN을 다시 확인해 주세요.";
      render();
      return;
    }
    if (isAdminUser(state.user)) {
      state.masterMode = true;
      state.gateOpen = false;
      state.notice = "마스터 모드가 열렸습니다.";
    } else {
      state.gateStep = "google";
      state.gateMessage = "PIN 확인이 완료되었습니다.";
    }
    render();
  });

  document.querySelector("#googleLogin")?.addEventListener("click", () => {
    runBusy(
      "google-login",
      async () => {
        state.user = await signInMaster();
        state.masterMode = true;
        state.gateOpen = false;
      },
      "마스터 모드가 열렸습니다.",
    );
  });

  document.querySelector("#pinChangeOpen")?.addEventListener("click", () => {
    state.pinChangeOpen = true;
    state.gateMessage = "";
    render();
  });

  document.querySelector("#pinChangeClose")?.addEventListener("click", () => {
    state.pinChangeOpen = false;
    state.gateMessage = "";
    render();
  });

  document.querySelector("#pinChangeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const current = document.querySelector("#currentPin").value;
    const next = document.querySelector("#nextPin").value;
    const confirmValue = document.querySelector("#confirmPin").value;
    if (current !== (localStorage.getItem(PIN_KEY) ?? DEFAULT_PIN)) {
      state.gateMessage = "현재 PIN이 맞지 않습니다.";
    } else if (!/^\d{4,}$/.test(next)) {
      state.gateMessage = "새 PIN은 숫자 4자리 이상으로 입력해 주세요.";
    } else if (next !== confirmValue) {
      state.gateMessage = "새 PIN 확인 값이 일치하지 않습니다.";
    } else {
      localStorage.setItem(PIN_KEY, next);
      state.pinChangeOpen = false;
      state.notice = "화면 잠금 PIN을 변경했습니다.";
      state.gateMessage = "";
    }
    render();
  });
}

function clearSharedData() {
  state.remoteMembers = [];
  state.completions = [];
  state.membersLoaded = false;
  state.completionsLoaded = false;
  state.selectedMemberId = fallbackMember.id;
  state.selectedLeaderId = "all";
  state.registrationLeaderId = zoneLeaders[0]?.id ?? "unassigned";
  state.connectionError = "";
  state.gateOpen = false;
  state.pinChangeOpen = false;
  state.notice = "";
  state.busy = "";
}

function stopSharedSubscription() {
  stopSharedData?.();
  stopSharedData = null;
}

function startSharedSubscription() {
  if (stopSharedData || !state.user) return;
  stopSharedData = subscribeSharedData({
    onMembers(nextMembers) {
      if (!state.user) return;
      state.remoteMembers = nextMembers;
      state.membersLoaded = true;
      state.connectionError = "";
      render();
    },
    onCompletions(nextCompletions) {
      if (!state.user) return;
      state.completions = nextCompletions;
      state.completionsLoaded = true;
      state.connectionError = "";
      render();
    },
    onError() {
      if (!state.user) return;
      state.membersLoaded = true;
      state.completionsLoaded = true;
      state.connectionError = "Firebase 연결을 확인해 주세요.";
      render();
    },
  });
}

subscribeAuth((user) => {
  if (user && !hasDashboardAccess(user)) {
    stopSharedSubscription();
    clearSharedData();
    state.user = null;
    state.masterMode = false;
    void signOutViewer().finally(() => {
      state.authReady = true;
      render();
    });
    return;
  }
  state.authReady = true;
  state.user = user;
  state.accessBusy = false;
  state.accessMessage = "";
  if (user) {
    startSharedSubscription();
  } else {
    stopSharedSubscription();
    clearSharedData();
    state.masterMode = false;
  }
  if (!isAdminUser(user)) state.masterMode = false;
  render();
});

window.setInterval(() => {
  const nextSeoulDateKey = seoulDateKey(new Date());
  if (nextSeoulDateKey === currentSeoulDateKey) return;
  currentSeoulDateKey = nextSeoulDateKey;
  if (state.authReady && state.user) render();
}, 60_000);

render();
