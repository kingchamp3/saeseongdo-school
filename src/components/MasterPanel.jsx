import React, { useState } from "react";

export default function MasterPanel({
  students,
  selectedStudent,
  onAddStudent,
  onDeleteStudent,
  onAddEncouragement
}) {
  const [newStudentName, setNewStudentName] = useState("");
  const [messageText, setMessageText] = useState("");

  const handleAddStudentSubmit = (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onAddStudent(newStudentName.trim());
    setNewStudentName("");
  };

  const handleSendMessageSubmit = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedStudent) return;
    onAddEncouragement(selectedStudent.id, messageText.trim());
    setMessageText("");
  };

  // 성도별 총 진척율 계산 (목록 표시용)
  const getOverallProgress = (student) => {
    const s1Count = Object.keys(student.school1Progress || {}).filter(k => student.school1Progress[k]).length;
    const s2Count = Object.keys(student.school2Progress || {}).filter(k => student.school2Progress[k]).length;
    return Math.round(((s1Count + s2Count) / 240) * 100);
  };

  return (
    <div className="glass-card master-panel-card">
      {/* 1. 마스터 판넬 헤더 및 성도 등록 */}
      <div className="master-panel-header">
        <div>
          <h2>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            마스터 관리자 센터
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            성도의 진행사항을 모니터링하고 격려 메시지를 보냅니다.
          </p>
        </div>

        <form onSubmit={handleAddStudentSubmit} className="add-student-form">
          <input
            type="text"
            className="text-input"
            placeholder="새성도 이름 입력"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            성도 등록
          </button>
        </form>
      </div>

      <div className="master-action-grid">
        {/* 2. 격려 카드 발송기 */}
        <div className="encourage-composer">
          <h3 style={{ fontSize: "0.95rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-brand-secondary)" }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            [{selectedStudent?.name || "선택 없음"}] 성도에게 격려 메시지 보내기
          </h3>

          <form onSubmit={handleSendMessageSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <textarea
              className="textarea-input"
              placeholder={
                selectedStudent
                  ? `${selectedStudent.name} 성도에게 힘이 되는 메시지를 작성해 보세요. 작성 완료 시 성도 모드에 즉시 노출됩니다.`
                  : "성도를 먼저 선택해 주세요."
              }
              disabled={!selectedStudent}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!selectedStudent || !messageText.trim()}
              style={{
                background: "linear-gradient(135deg, var(--color-brand-secondary), var(--color-brand-secondary-light))",
                alignSelf: "flex-end"
              }}
            >
              격려 카드 전송
            </button>
          </form>
        </div>

        {/* 3. 등록된 성도 리스트 요약 및 삭제 */}
        <div className="student-list-box">
          <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.25rem" }}>
            등록된 성도 관리 ({students.length}명)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto", paddingRight: "0.25rem" }}>
            {students.map((student) => (
              <div key={student.id} className="student-item-row">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: "700" }}>{student.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    진행률: {getOverallProgress(student)}%
                  </span>
                </div>

                <button
                  type="button"
                  className="student-delete-btn"
                  onClick={() => {
                    if (window.confirm(`${student.name} 성도의 모든 데이터를 삭제하시겠습니까?`)) {
                      onDeleteStudent(student.id);
                    }
                  }}
                  title="삭제하기"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
