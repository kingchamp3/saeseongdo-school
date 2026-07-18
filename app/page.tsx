"use client";

import { useMemo, useState } from "react";

const people = [
  { name: "김하늘", group: "새가족 A반", week: "5주차", rate: 83, status: "순항" },
  { name: "이은서", group: "새가족 A반", week: "4주차", rate: 67, status: "확인 필요" },
  { name: "박준호", group: "새가족 B반", week: "3주차", rate: 92, status: "순항" },
  { name: "최민지", group: "새가족 B반", week: "3주차", rate: 50, status: "연락 필요" },
  { name: "정다온", group: "새가족 C반", week: "2주차", rate: 75, status: "순항" },
];

export default function Home() {
  const [tab, setTab] = useState("대시보드");
  const [filter, setFilter] = useState("전체");
  const [checked, setChecked] = useState<string[]>([]);
  const shown = useMemo(() => filter === "전체" ? people : people.filter((p) => p.status === filter), [filter]);
  const toggle = (task: string) => setChecked((items) => items.includes(task) ? items.filter((item) => item !== task) : [...items, task]);

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">S</span><div><strong>새성도스쿨</strong><small>운영 대시보드</small></div></div>
      <nav>{["대시보드", "반별 진행", "성도 관리", "출결 현황", "자료실"].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "nav active" : "nav"}>{item}</button>)}</nav>
      <div className="manager"><span className="avatar">김</span><div><b>김은혜 간사</b><small>운영 관리자</small></div><button aria-label="설정">•••</button></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">2026년 7월 3주</p><h1>{tab}</h1><p className="sub">새성도들의 걸음을 놓치지 않도록, 오늘 필요한 일을 먼저 보여드려요.</p></div><div className="header-actions"><button className="ghost">이번 주 일정</button><button className="primary">+ 새 성도 등록</button></div></header>
      <section className="hero"><div><span className="badge">이번 주 핵심</span><h2>한 사람의 걸음을<br/>함께 살피는 한 주</h2><p>이번 주 3명의 새성도에게 짧은 안부를 전해 보세요.</p></div><div className="hero-ring"><b>76%</b><small>전체 평균<br/>진행률</small></div></section>
      <section className="stats"><article><span>등록 성도</span><b>42</b><small>지난주보다 4명 증가</small></article><article><span>평균 출석률</span><b>88<span>%</span></b><small>지난주보다 3% 상승</small></article><article><span>완료 예정</span><b>6</b><small>이번 달 수료 예정</small></article><article className="alert-stat"><span>돌봄 필요</span><b>3</b><small>확인이 필요한 성도</small></article></section>
      <div className="grid">
        <section className="panel progress"><div className="panel-head"><div><h3>반별 진행 현황</h3><p>현재 운영 중인 3개 반</p></div><button>전체 보기 →</button></div>{[["새가족 A반", "5주차 · 14명", 82], ["새가족 B반", "3주차 · 16명", 68], ["새가족 C반", "2주차 · 12명", 54]].map(([name, detail, rate]) => <div className="class-row" key={String(name)}><div className="class-icon">✦</div><div className="class-info"><b>{name}</b><small>{detail}</small><div className="bar"><i style={{ width: `${rate}%` }} /></div></div><strong>{rate}%</strong></div>)}</section>
        <section className="panel agenda"><div className="panel-head"><div><h3>이번 주 일정</h3><p>7월 14일 - 20일</p></div><button>캘린더</button></div><div className="agenda-item"><time><b>수</b><span>16</span></time><div><b>새성도스쿨 3주차</b><small>오후 7:30 · 소망홀</small></div></div><div className="agenda-item"><time><b>토</b><span>19</span></time><div><b>새가족 환영 모임</b><small>오후 2:00 · 카페 샬롬</small></div></div><button className="agenda-add">+ 일정 추가</button></section>
      </div>
      <section className="panel people"><div className="panel-head"><div><h3>돌봄이 필요한 성도</h3><p>진행률 또는 출석을 확인해 주세요.</p></div><div className="filters">{["전체", "확인 필요", "연락 필요"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="table"><div className="table-head"><span>이름</span><span>소속 반</span><span>진행</span><span>상태</span><span /></div>{shown.map((person) => <div className="person" key={person.name}><span className="person-name"><i>{person.name[0]}</i>{person.name}</span><span>{person.group}</span><span><b>{person.week}</b><small>{person.rate}% 완료</small></span><span className={person.status === "순항" ? "chip good" : "chip warn"}>{person.status}</span><button className="detail">보기 →</button></div>)}</div></section>
      <section className="tasks"><div><h3>오늘의 운영 체크</h3><p>작은 확인이 따뜻한 돌봄이 됩니다.</p></div>{["3주차 수업 자료를 반별로 전달하기", "최민지 성도에게 안부 메시지 보내기", "이번 주 출석부 확인하기"].map((task) => <label key={task} className={checked.includes(task) ? "done" : ""}><input type="checkbox" checked={checked.includes(task)} onChange={() => toggle(task)} /> <span>{task}</span></label>)}</section>
    </section>
  </main>;
}
