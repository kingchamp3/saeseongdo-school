import React, { useState, useEffect, useMemo } from "react";
import { INITIAL_STUDENTS, SCHOOL_1_STAGES, SCHOOL_2_STAGES } from "./mockData";
import Dashboard from "./components/Dashboard";
import Roadmap from "./components/Roadmap";
import MasterPanel from "./components/MasterPanel";
import AllStudentsList from "./components/AllStudentsList";
import { triggerConfetti, triggerGraduationConfetti } from "./components/Confetti";

const GLOBAL_PASSWORD = "1948"; // 홈화면 전체 진입 비밀번호
const MASTER_PASSWORD = "1925"; // 마스터 모드 진입 비밀번호
export default function App() {
  // 1. 상태 정의
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem("saeseongdo_students_v3");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = [...parsed];
        INITIAL_STUDENTS.forEach((initialStudent) => {
          if (!merged.some((s) => s.id === initialStudent.id)) {
            merged.push(initialStudent);
          }
        });
        return merged;
      } catch (e) {
        return INITIAL_STUDENTS;
      }
    }
    return INITIAL_STUDENTS;
  });

  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    const savedId = localStorage.getItem("saeseongdo_selected_id_v3");
    return savedId || (INITIAL_STUDENTS[0]?.id || "");
  });

  const [isMaster, setIsMaster] = useState(false); // 기본은 새성도 모드 (조회)
  const [activeTab, setActiveTab] = useState("school1");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("saeseongdo_theme") || "light";
  });

  // 홈화면 전체 비밀번호 상태
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [globalPasswordInput, setGlobalPasswordInput] = useState("");
  const [globalAuthError, setGlobalAuthError] = useState("");

  const handleGlobalAuthSubmit = (e) => {
    e.preventDefault();
    if (globalPasswordInput === GLOBAL_PASSWORD) {
      setIsAuthorized(true);
      setGlobalPasswordInput("");
      setGlobalAuthError("");
      triggerConfetti();
    } else {
      setGlobalAuthError("비밀번호가 일치하지 않습니다. 다시 입력해 주세요.");
    }
  };

  // 마스터 패스워드 검증 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (inputPassword === MASTER_PASSWORD) {
      setIsMaster(true);
      setShowPasswordModal(false);
      setInputPassword("");
      setPasswordError("");
      triggerConfetti(); // 마스터 인증 완료 시 가볍게 축포
    } else {
      setPasswordError("비밀번호가 일치하지 않습니다. 다시 입력해 주세요.");
    }
  };

  // 비밀 클릭 핸들러 (5회 터치 혹은 더블 클릭으로 마스터 모드 진입)
  const [logoClicks, setLogoClicks] = useState(0);
  const [clickTimeout, setClickTimeout] = useState(null);

  const handleLogoClick = () => {
    if (clickTimeout) clearTimeout(clickTimeout);
    
    const nextClicks = logoClicks + 1;
    if (nextClicks >= 5) {
      setShowPasswordModal(true);
      setLogoClicks(0);
    } else {
      setLogoClicks(nextClicks);
      setClickTimeout(setTimeout(() => {
        setLogoClicks(0);
      }, 3000));
    }
  };

  // 2. 로컬스토리지 저장 및 테마 설정
  useEffect(() => {
    localStorage.setItem("saeseongdo_students_v3", JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem("saeseongdo_selected_id_v3", selectedStudentId);
  }, [selectedStudentId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("saeseongdo_theme", theme);
  }, [theme]);

  // 3. 현재 선택된 학생 정보 가져오기
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  // 4. 이벤트 핸들러
  const handleToggleTopic = (school, stageId, topicIndex) => {
    if (!currentStudent) return;

    const progressKey = school === "school1" ? "school1Progress" : "school2Progress";
    const currentProgress = currentStudent[progressKey] || {};
    const topicKey = `${stageId}-${topicIndex}`;
    const wasCompleted = currentProgress[topicKey] === true;

    // 업데이트될 새로운 진행상태 복사
    const newProgress = {
      ...currentProgress,
      [topicKey]: !wasCompleted
    };

    // 만약 체크 취소했다면 key 삭제
    if (wasCompleted) {
      delete newProgress[topicKey];
    }

    // 이 단계의 이전 완료 갯수와 새 완료 갯수 계산 (폭죽 트리거용)
    const stagePrefix = `${stageId}-`;
    const getStageCompletedCount = (prog) => 
      Object.keys(prog).filter(key => key.startsWith(stagePrefix) && prog[key] === true).length;

    const prevStageCount = getStageCompletedCount(currentProgress);
    const newStageCount = getStageCompletedCount(newProgress);

    // 전체 완료 갯수 계산 (졸업 트리거용)
    const totalCount = Object.keys(newProgress).filter(k => newProgress[k]).length;

    // 상태 업데이트
    setStudents(prevStudents => 
      prevStudents.map(student => {
        if (student.id === currentStudent.id) {
          return {
            ...student,
            [progressKey]: newProgress
          };
        }
        return student;
      })
    );

    // 체크 활성화 시점에 폭죽 효과
    if (!wasCompleted) {
      const stages = school === "school1" ? SCHOOL_1_STAGES : SCHOOL_2_STAGES;
      const targetStage = stages.find(s => s.id === stageId);
      const maxStageTopics = targetStage ? targetStage.topics.length : 10;
      const totalMaxTopics = stages.reduce((acc, s) => acc + s.topics.length, 0);

      if (newStageCount === maxStageTopics) {
        // 단계를 100% 완료했을 때
        triggerConfetti();
        if (totalCount === totalMaxTopics) {
          // 스쿨 과정 전체 완료
          setTimeout(() => {
            triggerGraduationConfetti();
          }, 600);
        }
      }
    }
  };

  const handleAddStudent = (name) => {
    const newStudent = {
      id: `student-${Date.now()}`,
      name,
      registeredDate: new Date().toISOString().split("T")[0],
      school1Progress: {},
      school2Progress: {},
      encouragements: [
        {
          id: `enc-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          message: `${name}, 새성도스쿨 등록을 환영합니다! 동행하는 걸음마다 풍성한 은혜가 있기를 기도합니다.`
        }
      ]
    };
    setStudents(prev => [...prev, newStudent]);
    setSelectedStudentId(newStudent.id);
  };

  const handleDeleteStudent = (id) => {
    const remaining = students.filter(s => s.id !== id);
    setStudents(remaining);
    
    // 만약 삭제하려는 학생이 선택되어 있었다면 다른 학생으로 이동
    if (selectedStudentId === id) {
      setSelectedStudentId(remaining[0]?.id || "");
    }
  };

  const handleAddEncouragement = (studentId, message) => {
    setStudents(prev => 
      prev.map(student => {
        if (student.id === studentId) {
          return {
            ...student,
            encouragements: [
              {
                id: `enc-${Date.now()}`,
                date: new Date().toISOString().split("T")[0],
                message
              },
              ...(student.encouragements || [])
            ]
          };
        }
        return student;
      })
    );
    // 격려 메시지 전송 성공 시 축하 폭죽 가볍게 연출
    triggerConfetti();
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  // 5. 배지 획득 여부 계산 (대시보드 표시용)
  const badges = useMemo(() => {
    if (!currentStudent) return [];
    
    const s1Checked = Object.keys(currentStudent.school1Progress || {}).filter(k => currentStudent.school1Progress[k]).length;
    const s2Checked = Object.keys(currentStudent.school2Progress || {}).filter(k => currentStudent.school2Progress[k]).length;
    
    // 특정 단계 완수 체크
    const isStageCompleted = (schoolKey, stageId) => {
      const prog = currentStudent[schoolKey] || {};
      const stages = schoolKey === "school1Progress" ? SCHOOL_1_STAGES : SCHOOL_2_STAGES;
      const stage = stages.find(s => s.id === stageId);
      if (!stage) return false;
      for (let i = 0; i < stage.topics.length; i++) {
        if (!prog[`${stageId}-${i}`]) return false;
      }
      return true;
    };

    const s1Total = SCHOOL_1_STAGES.reduce((acc, s) => acc + s.topics.length, 0);
    const s2Total = SCHOOL_2_STAGES.reduce((acc, s) => acc + s.topics.length, 0);

    return [
      {
        id: "badge-start",
        name: "믿음의 시작",
        desc: "새성도스쿨의 첫 걸음을 내딛었습니다.",
        icon: "🌱",
        unlocked: s1Checked > 0 || s2Checked > 0
      },
      {
        id: "badge-belt",
        name: "진리의 허리띠",
        desc: "새성도스쿨 1과정의 1단계를 수료했습니다.",
        icon: "🎗️",
        unlocked: isStageCompleted("school1Progress", 1)
      },
      {
        id: "badge-breastplate",
        name: "의의 흉배",
        desc: "새성도스쿨 1과정의 3~4단계를 수료했습니다.",
        icon: "💖",
        unlocked: isStageCompleted("school1Progress", 3) && isStageCompleted("school1Progress", 4)
      },
      {
        id: "badge-shoes",
        name: "복음의 신발",
        desc: "새성도스쿨 1과정의 5단계를 수료했습니다.",
        icon: "👟",
        unlocked: isStageCompleted("school1Progress", 5)
      },
      {
        id: "badge-shield",
        name: "믿음의 방패",
        desc: "새성도스쿨 1과정의 6~8단계(발표 과정)를 수료했습니다.",
        icon: "🛡️",
        unlocked: isStageCompleted("school1Progress", 6) && isStageCompleted("school1Progress", 7) && isStageCompleted("school1Progress", 8)
      },
      {
        id: "badge-helmet",
        name: "구원의 투구",
        desc: "새성도스쿨 1과정을 모두 완료하여 수료했습니다.",
        icon: "🪖",
        unlocked: s1Checked === s1Total
      },
      {
        id: "badge-sword",
        name: "성령의검",
        desc: "새성도스쿨 2과정을 모두 완료하여 완수했습니다.",
        icon: "⚔️",
        unlocked: s2Checked === s2Total
      }
    ];
  }, [currentStudent]);

  if (!isAuthorized) {
    return (
      <div className="login-container">
        <div className="login-card glass-card">
          <div className="login-header">
            <div className="logo-icon flex-center" style={{ margin: "0 auto 1.5rem auto", width: "50px", height: "50px", fontSize: "1.5rem", background: "var(--gradient-brand)", borderRadius: "50%", color: "white" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7h20L12 2z" />
                <path d="M4 7v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7" />
                <path d="M9 22V14h6v8" />
                <circle cx="12" cy="10" r="1" />
              </svg>
            </div>
            <h2>새성도스쿨 디딤돌</h2>
            <p>보안을 위해 비밀번호를 입력해 주세요.</p>
          </div>
          <form onSubmit={handleGlobalAuthSubmit} className="login-form">
            <input
              type="password"
              className="text-input"
              placeholder="비밀번호 입력"
              value={globalPasswordInput}
              onChange={(e) => {
                setGlobalPasswordInput(e.target.value);
                if (globalAuthError) setGlobalAuthError("");
              }}
              autoFocus
              style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "6px", padding: "0.75rem" }}
            />
            {globalAuthError && <div className="error-text" style={{ textAlign: "center", marginTop: "0.5rem" }}>{globalAuthError}</div>}
            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "1rem", padding: "0.75rem" }}>
              입장하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. 상단 네비게이션 */}
      <nav className="navbar flex-row-center">
        <div className="logo-section">
          <div 
            className="logo-icon flex-center"
            onClick={handleLogoClick}
            onDoubleClick={() => setShowPasswordModal(true)}
            style={{ cursor: "pointer", userSelect: "none" }}
            title="새성도스쿨 디딤돌"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7h20L12 2z" />
              <path d="M4 7v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7" />
              <path d="M9 22V14h6v8" />
              <circle cx="12" cy="10" r="1" />
            </svg>
          </div>
          <div className="logo-text">
            <h1>새성도스쿨 디딤돌</h1>
            <p>양육 단계 체크 및 독려 대시보드</p>
          </div>
        </div>

        <div className="nav-controls">
          {/* 성도 선택 셀렉트 */}
          {students.length > 0 && (
            <div className="user-selector-wrapper">
              <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-muted)" }}>조회 대상:</span>
              <select
                className="select-dropdown"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 마스터 모드 활성화 시에만 종료 버튼을 표시 (평소에는 마스터 진입 메뉴가 완전히 숨겨짐) */}
          {isMaster && (
            <button
              className="btn-primary"
              style={{
                background: "var(--color-status-danger)",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8rem",
                padding: "0.4rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                boxShadow: "var(--shadow-sm)"
              }}
              onClick={() => setIsMaster(false)}
            >
              🔒 마스터 모드 종료
            </button>
          )}

          {/* 전체 화면 잠금 버튼 */}
          <button 
            className="theme-toggle-btn" 
            onClick={() => {
              setIsAuthorized(false);
              setIsMaster(false);
            }} 
            title="화면 잠금"
            style={{ marginRight: "0.5rem" }}
          >
            🔒
          </button>

          {/* 다크모드 토글 버튼 */}
          <button className="theme-toggle-btn" onClick={toggleTheme} title="테마 변경">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </nav>

      {/* 2. 마스터 관리 판넬 (마스터 모드 활성화 시 최상단 노출) */}
      {isMaster && (
        <MasterPanel
          students={students}
          selectedStudent={currentStudent}
          onAddStudent={handleAddStudent}
          onDeleteStudent={handleDeleteStudent}
          onAddEncouragement={handleAddEncouragement}
        />
      )}

      {/* 3. 대시보드 그리드 (진척도 게이지, 성구 플립카드, 격려의 글) */}
      <Dashboard student={currentStudent} />

      {/* 4. 성취 배지 쇼케이스 */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--color-brand-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          🏆 성취 배지 쇼케이스
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          양육 단계를 이수할 때마다 잠겨있던 믿음의 배지가 활성화됩니다.
        </p>
        <div className="badge-gallery">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`badge-item ${badge.unlocked ? "unlocked" : ""}`}
              title={`${badge.name}: ${badge.desc}`}
            >
              <div className="badge-icon-box flex-center">
                {badge.unlocked ? badge.icon : "🔒"}
              </div>
              <span className="badge-name">{badge.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. 새성도스쿨 탭 컨트롤 및 로드맵 */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "school1" ? "active" : ""}`}
            onClick={() => setActiveTab("school1")}
          >
            새성도스쿨 1 과정 (1~12단계)
          </button>
          <button
            className={`tab-btn ${activeTab === "school2" ? "active" : ""}`}
            onClick={() => setActiveTab("school2")}
          >
            새성도스쿨 2 과정 (1~12단계)
          </button>
        </div>

        {currentStudent ? (
          <Roadmap
            activeTab={activeTab}
            student={currentStudent}
            isMaster={isMaster}
            onToggleTopic={handleToggleTopic}
          />
        ) : (
          <div className="empty-state">등록된 대상이 없습니다. 우측 상단 마스터 모드에서 추가해 주세요.</div>
        )}
      </div>

      {/* 6. 전체 성도 진행 현황 한눈에 보기 */}
      <AllStudentsList
        students={students}
        selectedStudentId={selectedStudentId}
        onSelectStudent={setSelectedStudentId}
        isMaster={isMaster}
        onDeleteStudent={handleDeleteStudent}
      />

      {/* 마스터 인증 비밀번호 모달 */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <form onSubmit={handlePasswordSubmit} className="modal-content">
            <div className="modal-header">
              <span style={{ fontSize: "2.5rem" }}>🔐</span>
              <h3>마스터 권한 인증</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                마스터 권한을 획득하기 위해 비밀번호를 입력해 주세요.
              </p>
            </div>
            
            <div className="modal-body">
              <input
                type="password"
                className="text-input"
                placeholder="비밀번호 입력"
                value={inputPassword}
                onChange={(e) => {
                  setInputPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                autoFocus
                style={{ textAlign: "center", fontSize: "1.1rem", letterSpacing: "4px" }}
              />
              {passwordError && <div className="error-text">{passwordError}</div>}
            </div>
            
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowPasswordModal(false);
                  setInputPassword("");
                  setPasswordError("");
                }}
              >
                취소
              </button>
              <button type="submit" className="btn-primary">
                인증하기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
