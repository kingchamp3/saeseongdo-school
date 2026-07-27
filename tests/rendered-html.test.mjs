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

test("renders the completed Korean dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /새성도스쿨 디딤돌/);
  assert.match(html, /구역장 선택/);
  assert.match(html, /전체 구역/);
  assert.match(html, /믿음 성장 리더보드/);
  assert.match(html, /개별 학습 체크/);
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
  assert.match(page, /emailVerified\s*===\s*true/);
  assert.match(page, /signInWithPopup/);
  assert.match(page, /writeBatch/);
  assert.match(page, /selectedLeaderId/);
  assert.match(page, /visibleLeaderboard/);
  assert.doesNotMatch(page, /createdBy|completedBy/);
});

test("ships the full curriculum and GitHub Pages entrypoint", async () => {
  const [
    { school1Curriculum, school1TotalItems },
    index,
    staticApp,
    staticFirebase,
  ] =
    await Promise.all([
      import("../docs/curriculum.js"),
      readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
      readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
      readFile(new URL("../docs/firebase-sync.js", import.meta.url), "utf8"),
    ]);

  assert.equal(school1Curriculum.length, 12);
  assert.equal(school1TotalItems, 120);
  assert.ok(school1Curriculum.every((stage) => stage.items.length === 10));
  assert.match(index, /<script[^>]+type="module"[^>]+src="app\.js"/i);
  assert.match(staticApp, /믿음 성장 리더보드/);
  assert.match(staticApp, /id="leaderPicker"/);
  assert.match(staticApp, /selectedLeaderId:\s*"all"/);
  assert.match(staticApp, /이 구역에는 등록된 새성도가 없습니다/);
  assert.match(staticApp, /새성도 및 구역 편성 관리/);
  assert.match(staticFirebase, /limit\(200\)/);
  assert.match(staticFirebase, /limit\(5000\)/);
});
