import React, { useState, useEffect } from "react";
import { SCHOOL_1_STAGES, SCHOOL_2_STAGES } from "../mockData";

export default function Roadmap({ activeTab, student, isMaster, onToggleTopic }) {
  const stages = activeTab === "school1" ? SCHOOL_1_STAGES : SCHOOL_2_STAGES;
  const progressKey = activeTab === "school1" ? "school1Progress" : "school2Progress";
  const studentProgress = student ? student[progressKey] || {} : {};

  // 펼쳐진 단계 ID 관리 (초기값은 성도가 미완수한 첫 번째 단계)
  const [expandedStageId, setExpandedStageId] = useState(null);

  useEffect(() => {
    if (student) {
      // 첫 번째 미완수 단계 찾기
      const firstIncompleteStage = stages.find((stage) => {
        const completedCount = stage.topics.filter(
          (_, index) => studentProgress[`${stage.id}-${index}`] === true
        ).length;
        return completedCount < 10;
      });
      
      setExpandedStageId(firstIncompleteStage ? firstIncompleteStage.id : 1);
    }
  }, [student, activeTab]);

  const toggleAccordion = (id) => {
    setExpandedStageId(expandedStageId === id ? null : id);
  };

  if (!student) return null;

  return (
    <div className="roadmap-container">
      <div className="flex-row-center" style={{ marginBottom: "0.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-brand-primary)" }}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          {activeTab === "school1" ? "새성도스쿨 1 과정" : "새성도스쿨 2 과정"}
        </h2>
        {!isMaster && (
          <span style={{
            fontSize: "0.8rem",
            background: "rgba(217, 119, 6, 0.1)",
            color: "var(--color-brand-secondary)",
            padding: "0.25rem 0.75rem",
            borderRadius: "var(--radius-full)",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem"
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            마스터 전용 수정 모드 (조회 전용)
          </span>
        )}
      </div>

      {stages.map((stage) => {
        // 이 단계의 완료된 주제 수 계산
        const completedCount = stage.topics.filter(
          (_, index) => studentProgress[`${stage.id}-${index}`] === true
        ).length;
        
        const isCompleted = completedCount === 10;
        const isExpanded = expandedStageId === stage.id;

        return (
          <div
            key={stage.id}
            className={`roadmap-step-card ${isCompleted ? "completed" : ""} ${isExpanded ? "active-stage" : ""}`}
          >
            {/* 아코디언 헤더 */}
            <div
              className={`step-header-summary ${isExpanded ? "expanded" : ""}`}
              onClick={() => toggleAccordion(stage.id)}
            >
              <div className="step-title-block">
                <div className="step-number-badge">
                  {isCompleted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    stage.id
                  )}
                </div>
                <div className="step-title-text">
                  <h3>{stage.title}</h3>
                  <p>{isCompleted ? "축하합니다! 수료 완료" : `진행 중인 주제: ${completedCount}/10`}</p>
                </div>
              </div>

              <div className="step-progress-indicator">
                <span className="progress-pill">
                  {isCompleted ? "수료 완료" : `${completedCount * 10}%`}
                </span>
                <svg
                  className="chevron-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {/* 아코디언 상세 내용 (펼침 상태일 때만 렌더링) */}
            {isExpanded && (
              <div className="step-details-content">
                <p className="step-details-desc">{stage.description}</p>
                
                <div className="topics-grid">
                  {stage.topics.map((topic, index) => {
                    const topicKey = `${stage.id}-${index}`;
                    const isTopicCompleted = studentProgress[topicKey] === true;
                    
                    // 마스터 상태일 때와 아닐 때의 스타일링 클래스 구분
                    let labelClass = "topic-item-label";
                    if (!isMaster) {
                      labelClass += " read-only";
                      if (isTopicCompleted) labelClass += " viewer-checked";
                    } else {
                      if (isTopicCompleted) labelClass += " master-checked";
                    }

                    return (
                      <label
                        key={index}
                        className={labelClass}
                        onClick={(e) => {
                          if (!isMaster) {
                            // 마스터가 아니면 클릭 동작 금지
                            e.preventDefault();
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          className="topic-checkbox"
                          checked={isTopicCompleted}
                          disabled={!isMaster} // 마스터만 클릭 가능
                          onChange={() => {
                            if (isMaster) {
                              onToggleTopic(activeTab, stage.id, index);
                            }
                          }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ textDecoration: isTopicCompleted ? "line-through" : "none", opacity: isTopicCompleted ? 0.7 : 1 }}>
                            {index + 1}. {topic}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                            {isTopicCompleted ? "체크 완료" : isMaster ? "체크하기" : "진행 대기"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
