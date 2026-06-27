import React, { useMemo } from "react";
import { SCHOOL_1_STAGES, SCHOOL_2_STAGES } from "../mockData";

export default function AllStudentsList({ students, selectedStudentId, onSelectStudent, isMaster, onDeleteStudent }) {
  // 스쿨 1, 2 전체 주제 갯수 구하기
  const school1Total = useMemo(() => SCHOOL_1_STAGES.reduce((acc, s) => acc + s.topics.length, 0), []);
  const school2Total = useMemo(() => SCHOOL_2_STAGES.reduce((acc, s) => acc + s.topics.length, 0), []);
  const totalTotal = school1Total + school2Total;

  if (!students || students.length === 0) return null;

  return (
    <div className="glass-card" style={{ marginTop: "2rem" }}>
      <div className="card-header" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>📊</span> 전체 성도 진행 현황 한눈에 보기
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
          등록된 모든 성도들의 학습 진척도와 최근 소통 상황을 비교 조회합니다.
        </p>
      </div>

      <div className="table-responsive" style={{ overflowX: "auto" }}>
        <table className="custom-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
              <th style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-muted)" }}>이름</th>
              <th style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-muted)" }}>등록일</th>
              <th style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-muted)" }}>새성도스쿨 1과정 ({school1Total}점)</th>
              <th style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-muted)" }}>새성도스쿨 2과정 ({school2Total}점)</th>
              <th style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-muted)", width: "30%" }}>전체 진척율</th>
              <th style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-muted)", textAlign: "center" }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const s1Checked = Object.keys(student.school1Progress || {}).filter(k => student.school1Progress[k]).length;
              const s2Checked = Object.keys(student.school2Progress || {}).filter(k => student.school2Progress[k]).length;
              
              const s1Percent = school1Total > 0 ? Math.round((s1Checked / school1Total) * 100) : 0;
              const s2Percent = school2Total > 0 ? Math.round((s2Checked / school2Total) * 100) : 0;
              const totalPercent = totalTotal > 0 ? Math.round(((s1Checked + s2Checked) / totalTotal) * 100) : 0;
              
              const isSelected = student.id === selectedStudentId;

              return (
                <tr 
                  key={student.id} 
                  style={{ 
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: isSelected ? "rgba(45, 106, 79, 0.08)" : "transparent",
                    transition: "background 0.2s"
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: "1rem 0.75rem", fontWeight: "600" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.1rem" }}>👤</span>
                      <span>{student.name}</span>
                      {isSelected && <span className="active-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-brand-secondary)" }} />}
                    </div>
                  </td>
                  <td style={{ padding: "1rem 0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                    {student.registeredDate}
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>{s1Checked} / {school1Total}</span>
                      <span style={{ fontSize: "0.75rem", color: s1Percent === 100 ? "var(--color-brand-secondary)" : "var(--color-text-muted)" }}>
                        {s1Percent === 100 ? "🎓 수료 완료" : `${s1Percent}% 진행`}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>{s2Checked} / {school2Total}</span>
                      <span style={{ fontSize: "0.75rem", color: s2Percent === 100 ? "var(--color-brand-secondary)" : "var(--color-text-muted)" }}>
                        {s2Percent === 100 ? "👑 완수 완료" : `${s2Percent}% 진행`}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div className="progress-bar-bg" style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${totalPercent}%`, 
                            height: "100%", 
                            background: totalPercent === 100 
                              ? "linear-gradient(90deg, #d97706, #fbbf24)" 
                              : "linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-accent))",
                            borderRadius: "var(--radius-full)" 
                          }} 
                        />
                      </div>
                      <span style={{ fontSize: "0.85rem", fontWeight: "700", width: "40px", textAlign: "right" }}>{totalPercent}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "1rem 0.75rem", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                      <button 
                        onClick={() => onSelectStudent(student.id)}
                        className={`btn-select ${isSelected ? "active" : ""}`}
                        style={{
                          padding: "0.35rem 0.75rem",
                          fontSize: "0.8rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: isSelected ? "var(--color-brand-primary)" : "rgba(255,255,255,0.05)",
                          color: isSelected ? "white" : "var(--color-text-primary)",
                          cursor: "pointer",
                          fontWeight: "600",
                          transition: "all 0.2s"
                        }}
                      >
                        {isSelected ? "선택됨" : "조회하기"}
                      </button>
                      
                      {isMaster && (
                        <button 
                          onClick={() => {
                            if (window.confirm(`${student.name} 성도의 데이터를 삭제하시겠습니까?`)) {
                              onDeleteStudent(student.id);
                            }
                          }}
                          style={{
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.8rem",
                            borderRadius: "var(--radius-md)",
                            border: "none",
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#f87171",
                            cursor: "pointer",
                            fontWeight: "600",
                            transition: "all 0.2s"
                          }}
                          className="btn-delete-hover"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
