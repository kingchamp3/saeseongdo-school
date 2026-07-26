import {
  regionLeader,
  school1Curriculum,
  school1TotalItems,
  zoneLeaders,
} from "./curriculum.js";
import {
  addMember,
  changeMemberLeader,
  isAdminUser,
  removeMember,
  seedDefaultMember,
  setItemCompletion,
  signInMaster,
  signOutMaster,
  subscribeAuth,
  subscribeSharedData,
} from "./firebase-sync.js";

const DEFAULT_PIN = "1925";
const PIN_KEY = "didimdol-screen-lock-pin";
const THEME_KEY = "didimdol-theme";
const fallbackMember = {
  id: "park-deukyong",
  name: "박득용 형제님",
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
  user: null,
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
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
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

function zoneSummaries() {
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
    return { leader, people, average };
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
  const list = members();
  if (list.length && !list.some((member) => member.id === state.selectedMemberId)) {
    state.selectedMemberId = list[0].id;
  }
  const selected = selectedMember();
  const selectedProgress = selected ? progressFor(selected) : null;
  const selectedCompletions = selected ? completionMap(selected.id) : new Map();
  const ranking = leaderboard();
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
          <span>대상 성도</span>
          <select id="memberPicker" ${list.length ? "" : "disabled"}>
            ${list.length
              ? list
                  .map(
                    (member) =>
                      `<option value="${escapeHtml(member.id)}" ${
                        member.id === selected?.id ? "selected" : ""
                      }>${escapeHtml(member.name)}</option>`,
                  )
                  .join("")
              : "<option>불러오는 중</option>"}
          </select>
        </label>
        <button class="icon-button" id="themeButton" type="button" aria-label="테마 전환">${
          state.dark ? "☀️" : "🌙"
        }</button>
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

      <section class="section-block">
        <div class="section-heading">
          <div><p class="eyebrow">구역별 한눈에 보기</p><h2>우리 구역 성장 현황</h2></div>
          <p>구역원의 평균 진도를 기준으로 표시합니다.</p>
        </div>
        <div class="zone-grid">
          ${zoneSummaries()
            .map(
              ({ leader, people, average }) => `
                <article class="zone-card">
                  <div class="zone-head">
                    <span>${leader.id === "unassigned" ? "?" : escapeHtml(initial(leader.name))}</span>
                    <div><strong>${
                      leader.id === "unassigned"
                        ? "미편성"
                        : `${escapeHtml(leader.name)} 구역장`
                    }</strong><small>${people.length}명 학습 중</small></div>
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
          <div><p class="eyebrow">믿음 성장 리더보드</p><h2>한 걸음 앞선 주인공</h2></div>
          <p>동점이면 이름순으로 표시합니다. 서로 따뜻하게 응원해 주세요.</p>
        </div>
        <div class="table-wrap">
          <table class="leaderboard">
            <thead><tr><th>순위</th><th>성도</th><th>담당 구역장</th><th>현재 단계</th><th>완료</th><th>전체 진도</th><th></th></tr></thead>
            <tbody>
              ${
                loading
                  ? '<tr><td colspan="7" class="empty-cell">리더보드를 불러오고 있습니다.</td></tr>'
                  : ranking
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
                  ? `<div class="seed-banner"><div><strong>공유 명단이 비어 있습니다.</strong><span>현재 보이는 박득용 형제님은 기본 안내입니다.</span></div><button id="seedMember" type="button" ${
                      state.busy ? "disabled" : ""
                    }>박득용 형제님 등록</button></div>`
                  : ""
              }
              <p class="consent-note">이름·구역·진도·완료 시각이 구성원에게 공유됩니다. 공개 동의를 확인한 뒤 등록하세요.</p>
              <form class="add-member-form" id="addMemberForm">
                <label><span>새성도 이름</span><input id="newMemberName" maxlength="30" required placeholder="예: 홍길동 형제님" /></label>
                <label><span>담당 구역장</span><select id="newMemberLeader">${zoneLeaders
                  .map(
                    (leader) =>
                      `<option value="${leader.id}">${escapeHtml(leader.name)}</option>`,
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
            ? '<div class="inline-info">먼저 관리 영역에서 박득용 형제님을 공유 명단에 등록하면 진도를 체크할 수 있습니다.</div>'
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

  document.querySelector("#memberPicker")?.addEventListener("change", (event) => {
    state.selectedMemberId = event.target.value;
    state.openStage = 1;
    render();
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
    await signOutMaster().catch(() => {});
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
    runBusy(
      "add-member",
      async () => {
        const id = await addMember(name, leaderId);
        state.selectedMemberId = id;
      },
      `${name}을(를) ${leaderName(leaderId)} 구역에 등록했습니다.`,
    );
  });

  document.querySelector("#seedMember")?.addEventListener("click", () => {
    runBusy(
      "seed-member",
      async () => {
        state.selectedMemberId = await seedDefaultMember();
      },
      "박득용 형제님을 공유 명단에 등록했습니다.",
    );
  });

  document.querySelectorAll("[data-member-leader]").forEach((select) => {
    select.addEventListener("change", () => {
      runBusy(
        `leader-${select.dataset.memberLeader}`,
        () =>
          changeMemberLeader(select.dataset.memberLeader, select.value),
        `담당 구역을 ${leaderName(select.value)} 구역으로 변경했습니다.`,
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

subscribeAuth((user) => {
  state.user = user;
  if (!isAdminUser(user)) state.masterMode = false;
  render();
});

subscribeSharedData({
  onMembers(nextMembers) {
    state.remoteMembers = nextMembers;
    state.membersLoaded = true;
    state.connectionError = "";
    render();
  },
  onCompletions(nextCompletions) {
    state.completions = nextCompletions;
    state.completionsLoaded = true;
    state.connectionError = "";
    render();
  },
  onError() {
    state.membersLoaded = true;
    state.completionsLoaded = true;
    state.connectionError = "Firebase 연결을 확인해 주세요.";
    render();
  },
});

render();
