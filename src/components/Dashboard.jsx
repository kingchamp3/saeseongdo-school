import React, { useMemo } from "react";
import { SCHOOL_1_STAGES, SCHOOL_2_STAGES } from "../mockData";

// 추천 말씀 카드 배열
const BIBLE_VERSES = [
  {
    verse: "그런즉 누구든지 그리스도 안에 있으면 새로운 피조물이라 이전 것은 지나갔으니 보라 새 것이 되었도다",
    citation: "고린도후서 5:17",
    tag: "새로운 시작"
  },
  {
    verse: "네 시작은 미약하였으나 네 나중은 심히 창대하리라",
    citation: "욥기 8:7",
    tag: "성장과 축복"
  },
  {
    verse: "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라",
    citation: "잠언 3:5-6",
    tag: "인도하심"
  },
  {
    verse: "내가 너에게 명령한 것이 아니냐 강하고 담대하라 두려워하지 말며 놀라지 말라 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라 하시니라",
    citation: "여호수아 1:9",
    tag: "용기와 동행"
  },
  {
    verse: "여호와는 너를 지키시는 이시라 여호와께서 네 오른쪽에서 네 그늘이 되시나니",
    citation: "시편 121:5",
    tag: "보호하심"
  }
];

export default function Dashboard({ student }) {
  // 진척율 계산
  const { school1Percent, school2Percent, totalPercent, school1Checked, school2Checked } = useMemo(() => {
    if (!student) return { school1Percent: 0, school2Percent: 0, totalPercent: 0, school1Checked: 0, school2Checked: 0 };
    
    // 스쿨 1 전체 주제 갯수 계산
    const school1Total = SCHOOL_1_STAGES.reduce((acc, s) => acc + s.topics.length, 0);
    const school1CheckedCount = Object.keys(student.school1Progress || {}).filter(
      (key) => student.school1Progress[key] === true
    ).length;
    
    // 스쿨 2 전체 주제 갯수 계산
    const school2Total = SCHOOL_2_STAGES.reduce((acc, s) => acc + s.topics.length, 0);
    const school2CheckedCount = Object.keys(student.school2Progress || {}).filter(
      (key) => student.school2Progress[key] === true
    ).length;
    
    const s1Percent = school1Total > 0 ? Math.round((school1CheckedCount / school1Total) * 100) : 0;
    const s2Percent = school2Total > 0 ? Math.round((school2CheckedCount / school2Total) * 100) : 0;
    const totalSum = school1Total + school2Total;
    const tPercent = totalSum > 0 ? Math.round(((school1CheckedCount + school2CheckedCount) / totalSum) * 100) : 0;
    
    return {
      school1Percent: s1Percent,
      school2Percent: s2Percent,
      totalPercent: tPercent,
      school1Checked: school1CheckedCount,
      school2Checked: school2CheckedCount
    };
  }, [student]);

  // 성도 상태에 맞는 말씀 카드 선택
  const activeVerse = useMemo(() => {
    // 성도의 id나 완료 상태를 시드로 사용하여 오늘의 말씀 고정
    const index = student ? (student.name.charCodeAt(0) + school1Checked) % BIBLE_VERSES.length : 0;
    return BIBLE_VERSES[index];
  }, [student, school1Checked]);

  if (!student) {
    return (
      <div className="glass-card flex-center empty-state" style={{ gridColumn: "span 12" }}>
        선택된 성도 정보가 없습니다. 성도를 추가하거나 선택해 주세요.
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {/* 1. 전체 진행 상황 카드 */}
      <div className="glass-card progress-summary-card">
        <div className="progress-header">
          <div className="progress-info">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {student.name} 성도의 믿음 여정
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              등록일: {student.registeredDate} | 총 240개의 주제 중 {school1Checked + school2Checked}개 완수
            </p>
          </div>
          <div className="percent-display">{totalPercent}%</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${totalPercent}%` }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>
            <span>믿음의 출발</span>
            <span>수료와 파송</span>
          </div>
        </div>

        <div className="progress-submetrics">
          <div className="submetric-box">
            <div className="flex-row-center" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
              <span>새성도스쿨 1</span>
              <span style={{ color: 'var(--color-brand-primary-light)' }}>
                {school1Percent}% ({school1Checked}/120)
              </span>
            </div>
            <div className="submetric-bar-track">
              <div className="submetric-bar-fill-1" style={{ width: `${school1Percent}%` }}></div>
            </div>
          </div>

          <div className="submetric-box">
            <div className="flex-row-center" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
              <span>새성도스쿨 2</span>
              <span style={{ color: 'var(--color-brand-secondary)' }}>
                {school2Percent}% ({school2Checked}/120)
              </span>
            </div>
            <div className="submetric-bar-track">
              <div className="submetric-bar-fill-2" style={{ width: `${school2Percent}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 말씀 카드 (Flip 3D Effect) */}
      <div className="word-card-wrapper">
        <div className="word-card-inner">
          {/* 앞면: 격려의 타이틀 */}
          <div className="word-card-front">
            <span style={{
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: '700',
              marginBottom: '1rem'
            }}>
              오늘의 격려말씀 💌
            </span>
            <h3 style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{activeVerse.tag}</h3>
            <p>마우스를 올리거나 터치하여<br />하나님의 약속을 확인해 보세요.</p>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '1.5rem', opacity: '0.6', animation: 'bounce 2s infinite' }}>
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
          </div>

          {/* 뒷면: 성구 및 출처 */}
          <div className="word-card-back">
            <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✨</span>
            <blockquote style={{ padding: '0 0.5rem', margin: '0.5rem 0' }}>
              "{activeVerse.verse}"
            </blockquote>
            <cite>— {activeVerse.citation}</cite>
          </div>
        </div>
      </div>

      {/* 3. 인도자(멘토)로부터의 격려 카드 리스트 */}
      <div className="glass-card" style={{ gridColumn: "span 12", display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-brand-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-brand-secondary)' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          인도자가 전하는 사랑의 메시지
        </h3>
        
        {(!student.encouragements || student.encouragements.length === 0) ? (
          <div className="empty-state" style={{ padding: '1rem' }}>
            아직 도착한 격려 메시지가 없습니다. 힘찬 여정을 시작해 보세요!
          </div>
        ) : (
          <div className="encouragements-timeline">
            {student.encouragements.map((enc) => (
              <div key={enc.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--color-brand-primary-light)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  flexShrink: 0
                }}>
                  목
                </div>
                <div className="encouragement-bubble" style={{ flexGrow: 1 }}>
                  <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>{enc.message}</div>
                  <div className="encouragement-bubble-date">{enc.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
