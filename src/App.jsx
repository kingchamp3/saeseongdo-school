import React, { useState, useEffect, useMemo } from "react";
import { INITIAL_STUDENTS } from "./mockData";
import Dashboard from "./components/Dashboard";
import Roadmap from "./components/Roadmap";
import MasterPanel from "./components/MasterPanel";
import { triggerConfetti, triggerGraduationConfetti } from "./components/Confetti";

const MASTER_PASSWORD = "1925"; // 마스터 모드 진입 비밀번호
export default function App() {
  // 1. 상태 정의
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem("saeseongdo_students_v3");
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
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
      if (newStageCount === 10) {
        // 단계를 100% 완료했을 때 (10개 주제 모두 체크)
        triggerConfetti();
        if (totalCount === 120) {
          // 스쿨 과정 전체 완료 (120개 완수)
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
          message: `${name} 성도님, 새성도스쿨 등록을 환영합니다! 동행하는 걸음마다 풍성한 은혜가 있기를 기도합니다.`
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
      for (let i = 0; i < 10; i++) {
        if (!prog[`${stageId}-${i}`]) return false;
      }
      return true;
    };

    return [
      {
        id: "badge-welcome",
        name: "믿음의 시작",
        desc: "첫 미션을 수행했습니다.",
        icon: "🌱",
        unlocked: s1Checked > 0 || s2Checked > 0
      },
      {
        id: "badge-word",
        name: "말씀의 사람",
        desc: "스쿨 1의 6단계(성경)를 마쳤습니다.",
        icon: "📖",
        unlocked: isStageCompleted("school1Progress", 6)
      },
      {
        id: "badge-prayer",
        name: "기도의 용사",
        desc: "스쿨 1의 7단계(기도)를 마쳤습니다.",
        icon: "🙏",
        unlocked: isStageCompleted("school1Progress", 7)
      },
      {
        id: "badge-school1-grad",
        name: "스쿨 1 수료",
        desc: "새성도스쿨 1을 모두 완수했습니다.",
        icon: "🎓",
        unlocked: s1Checked === 120
      },
      {
        id: "badge-disciple",
        name: "스쿨 2 진입",
        desc: "새성도스쿨 2 과정을 개시했습니다.",
        icon: "🛡️",
        unlocked: s2Checked > 0
      },
      {
        id: "badge-school2-grad",
        name: "지상 사명 파송",
        desc: "새성도스쿨 2 과정을 모두 완수했습니다.",
        icon: "👑",
        unlocked: s2Checked === 120
      }
    ];
  }, [currentStudent]);

  return (
    <div className="app-container">
      {/* 1. 상단 네비게이션 */}
      <nav className="navbar flex-row-center">
        <div className="logo-section">
          <div 
            onClick={handleLogoClick}
            onDoubleClick={() => setShowPasswordModal(true)}
            style={{ cursor: "pointer", userSelect: "none", width: "40px", height: "40px", flexShrink: 0, marginRight: "0.25rem" }}
            title="새성도스쿨 디딤돌"
          >
            <svg width="40" height="40" viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
              <defs>
                <radialGradient id="globeGrad" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                  <stop offset="0%" stopColor="#2d6a4f" />
                  <stop offset="100%" stopColor="#1b4332" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#globeGrad)" stroke="#40916c" strokeWidth="3"/>
              
              <path d="M 8 50 Q 50 25 92 50" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" fill="none"/>
              <path d="M 8 50 Q 50 75 92 50" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" fill="none"/>
              <path d="M 50 8 Q 30 50 50 92" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" fill="none"/>
              <path d="M 50 8 Q 70 50 50 92" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" fill="none"/>
              <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"/>
              <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"/>

              <path d="M 24 70 C 15 50, 24 28, 44 22 C 34 32, 31 52, 33 68 Z" fill="#d97706" opacity="0.9"/>
              <path d="M 39 77 C 30 55, 39 33, 61 27 C 50 38, 46 58, 48 75 Z" fill="#f59e0b" opacity="0.95"/>
              <path d="M 54 82 C 45 60, 54 38, 77 34 C 66 45, 61 65, 63 80 Z" fill="#fbbf24"/>
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
              <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-muted)" }}>대상 성도:</span>
              <select
                className="select-dropdown"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} 성도
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
          <div className="empty-state">등록된 성도가 없습니다. 우측 상단 마스터 모드에서 새성도를 추가해 주세요.</div>
        )}
      </div>

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
