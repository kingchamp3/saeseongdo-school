import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the protected Korean access gate before authentication", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /새성도스쿨 디딤돌/);
  assert.match(html, /안전한 접속 상태를 확인하고 있습니다/);
  assert.doesNotMatch(html, /구역장 선택|믿음 성장 리더보드|개별 학습 체크/);
  assert.doesNotMatch(html, /박득용|park-deukyong/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps Firebase reads bounded and writes behind verified admin auth", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /query\(collection\(db,\s*"members"\),\s*limit\(200\)\)/);
  assert.match(
    page,
    /query\(collection\(db,\s*"completions"\),\s*limit\(5000\)\)/,
  );
  assert.match(page, /ADMIN_EMAIL\s*=\s*"kingchamp3@gmail\.com"/);
  assert.match(page, /VIEWER_EMAIL\s*=\s*"viewer@new-saint-school\.web\.app"/);
  assert.match(page, /emailVerified\s*===\s*true/);
  assert.match(page, /signInWithEmailAndPassword/);
  assert.match(page, /browserSessionPersistence/);
  assert.match(page, /if \(!user\)/);
  assert.match(page, /signInWithPopup/);
  assert.match(page, /writeBatch/);
  assert.match(page, /selectedLeaderId/);
  assert.match(page, /visibleLeaderboard/);
  assert.doesNotMatch(page, /createdBy|completedBy|박득용|park-deukyong/);
});

test("ships the full curriculum and GitHub Pages entrypoint", async () => {
  const [
    { regionLeader, school1Curriculum, school1TotalItems, zoneLeaders },
    reactPage,
    curriculumSource,
    index,
    staticApp,
    staticFirebase,
    firestoreRules,
  ] =
    await Promise.all([
      import("../docs/curriculum.js"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../docs/curriculum.js", import.meta.url), "utf8"),
      readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
      readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
      readFile(new URL("../docs/firebase-sync.js", import.meta.url), "utf8"),
      readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    ]);

  assert.equal(school1Curriculum.length, 12);
  assert.equal(school1TotalItems, 120);
  assert.ok(school1Curriculum.every((stage) => stage.items.length === 10));
  assert.equal(regionLeader, "한정석");
  assert.deepEqual(
    zoneLeaders,
    [
      { id: "kwon-gyeongyong", name: "1구역" },
      { id: "seo-taewon", name: "2구역" },
      { id: "son-changbae", name: "3구역" },
      { id: "lee-minwoo", name: "4구역" },
      { id: "lee-eungseon", name: "5구역" },
      { id: "unassigned", name: "미편성" },
    ],
  );
  const appSources = [reactPage, curriculumSource, index, staticApp, staticFirebase].join("\n");
  for (const zoneLabel of ["1구역", "2구역", "3구역", "4구역", "5구역"]) {
    assert.match(appSources, new RegExp(zoneLabel));
  }
  for (const formerLeaderName of ["권경용", "서태원", "손창배", "이민우", "이응선"]) {
    assert.doesNotMatch(appSources, new RegExp(formerLeaderName));
  }
  assert.match(index, /<script[^>]+type="module"[^>]+src="app\.js"/i);
  assert.match(staticApp, /믿음 성장 리더보드/);
  assert.match(staticApp, /id="leaderPicker"/);
  assert.match(staticApp, /selectedLeaderId:\s*"all"/);
  assert.match(staticApp, /이 구역에는 등록된 새성도가 없습니다/);
  assert.match(staticApp, /새성도 및 구역 편성 관리/);
  assert.match(staticApp, /authReady:\s*false/);
  assert.match(staticApp, /접속 비밀번호/);
  assert.doesNotMatch(staticApp, /박득용|park-deukyong/);
  assert.match(staticFirebase, /signInWithEmailAndPassword/);
  assert.match(staticFirebase, /browserSessionPersistence/);
  assert.match(staticFirebase, /limit\(200\)/);
  assert.match(staticFirebase, /limit\(5000\)/);
  assert.doesNotMatch(staticFirebase, /박득용|park-deukyong/);
  assert.match(firestoreRules, /function canReadSharedData\(\)/);
  assert.match(
    firestoreRules,
    /request\.auth\.uid == 'iqZne8O4HrNS3Lo2NtCdIaleytB2'/,
  );
  assert.match(firestoreRules, /sign_in_provider == 'password'/);
  assert.doesNotMatch(firestoreRules, /allow (?:get|list|read): if true/);
});
