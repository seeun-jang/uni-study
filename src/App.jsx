import { useEffect, useMemo, useState } from 'react';

const TODO_STORAGE_KEY = 'uni-study.todos';
const POMODORO_STORAGE_KEY = 'uni-study.pomodoro';
const GITHUB_LOG_STORAGE_KEY = 'uni-study.githubLogs';
const QUESTION_NOTE_STORAGE_KEY = 'uni-study.questionNote';

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const QUESTION_TEMPLATES = [
  '이 개념 쉽게 설명해줘',
  '오늘 공부 계획 짜줘',
  '에러 원인 분석해줘',
  '이 코드를 리팩토링해줘',
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function isToday(isoDate) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

// 추후 Azure Functions의 /api/analyze로 분리하기 쉽도록 함수 이름 유지
export function analyzeStudyData({
  completedTodoCount,
  totalTodoCount,
  completedPomodoros,
  totalFocusMinutes,
  todayCommitCount,
  questionNote,
}) {
  const todoRate = totalTodoCount > 0 ? completedTodoCount / totalTodoCount : 0;
  const todoScore = Math.min(todoRate * 30, 30);
  const pomodoroScore = Math.min(completedPomodoros * 10, 25);
  const focusScore = Math.min((totalFocusMinutes / 120) * 20, 20);
  const commitScore = Math.min(todayCommitCount * 5, 15);
  const questionScore = questionNote.trim() ? 10 : 0;

  const score = Math.round(
    Math.min(todoScore + pomodoroScore + focusScore + commitScore + questionScore, 100)
  );

  let recommendation = '좋아요. 지금 리듬을 유지하면서 작은 목표를 계속 완료해보세요.';
  if (totalTodoCount === 0) {
    recommendation = '먼저 오늘 할 일을 1개 이상 등록해보세요.';
  } else if (todoRate < 0.5) {
    recommendation = '우선순위 높은 할 일부터 1개 완료해 흐름을 만드세요.';
  } else if (completedPomodoros === 0) {
    recommendation = '25분 집중 타이머를 1회 시작해 집중 루틴을 켜보세요.';
  } else if (todayCommitCount === 0) {
    recommendation = '짧은 학습 정리라도 커밋 1개를 남겨 기록을 시작하세요.';
  } else if (!questionNote.trim()) {
    recommendation = 'AI 질문 메모에 현재 막힌 지점을 한 줄로 남겨보세요.';
  } else if (score >= 85) {
    recommendation = '매우 좋습니다. 남은 시간에는 복습 또는 심화 문제를 진행해보세요.';
  } else if (score >= 60) {
    recommendation = '좋은 페이스입니다. 다음 뽀모도로 1회와 커밋 1개를 목표로 해보세요.';
  }

  return { score, recommendation };
}

function App() {
  // Todo
  const [todos, setTodos] = useState([]);
  const [todoText, setTodoText] = useState('');
  const [todoCategory, setTodoCategory] = useState('전공');
  const [todoPriority, setTodoPriority] = useState('중');

  // Pomodoro
  const [mode, setMode] = useState('focus'); // focus | break
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);

  // GitHub Study Log
  const [repoName, setRepoName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [commitLogs, setCommitLogs] = useState([]);

  // AI Study Assistant
  const [questionNote, setQuestionNote] = useState('');

  // 초기 로드
  useEffect(() => {
    const savedTodos = safeParse(localStorage.getItem(TODO_STORAGE_KEY), []);
    const savedPomodoro = safeParse(localStorage.getItem(POMODORO_STORAGE_KEY), null);
    const savedGithubLogs = safeParse(localStorage.getItem(GITHUB_LOG_STORAGE_KEY), []);
    const savedQuestionNote = localStorage.getItem(QUESTION_NOTE_STORAGE_KEY) || '';

    setTodos(Array.isArray(savedTodos) ? savedTodos : []);
    setCommitLogs(Array.isArray(savedGithubLogs) ? savedGithubLogs : []);
    setQuestionNote(savedQuestionNote);

    if (savedPomodoro) {
      setMode(savedPomodoro.mode === 'break' ? 'break' : 'focus');
      setSecondsLeft(
        Number.isInteger(savedPomodoro.secondsLeft)
          ? savedPomodoro.secondsLeft
          : savedPomodoro.mode === 'break'
          ? BREAK_SECONDS
          : FOCUS_SECONDS
      );
      setCompletedPomodoros(
        Number.isInteger(savedPomodoro.completedPomodoros) ? savedPomodoro.completedPomodoros : 0
      );
      setTotalFocusMinutes(
        Number.isInteger(savedPomodoro.totalFocusMinutes) ? savedPomodoro.totalFocusMinutes : 0
      );
    }
  }, []);

  // localStorage 저장
  useEffect(() => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(
      POMODORO_STORAGE_KEY,
      JSON.stringify({
        mode,
        secondsLeft,
        completedPomodoros,
        totalFocusMinutes,
      })
    );
  }, [mode, secondsLeft, completedPomodoros, totalFocusMinutes]);

  useEffect(() => {
    localStorage.setItem(GITHUB_LOG_STORAGE_KEY, JSON.stringify(commitLogs));
  }, [commitLogs]);

  useEffect(() => {
    localStorage.setItem(QUESTION_NOTE_STORAGE_KEY, questionNote);
  }, [questionNote]);

  // 타이머 동작
  useEffect(() => {
    if (!isRunning) return undefined;

    const timerId = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        if (mode === 'focus') {
          setCompletedPomodoros((count) => count + 1);
          setTotalFocusMinutes((min) => min + 25);
          setMode('break');
          return BREAK_SECONDS;
        }

        setMode('focus');
        return FOCUS_SECONDS;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [isRunning, mode]);

  const completedTodoCount = useMemo(() => todos.filter((t) => t.done).length, [todos]);
  const totalTodoCount = todos.length;
  const todayCommitCount = useMemo(
    () => commitLogs.filter((log) => isToday(log.createdAt)).length,
    [commitLogs]
  );

  const summary = useMemo(
    () =>
      analyzeStudyData({
        completedTodoCount,
        totalTodoCount,
        completedPomodoros,
        totalFocusMinutes,
        todayCommitCount,
        questionNote,
      }),
    [
      completedTodoCount,
      totalTodoCount,
      completedPomodoros,
      totalFocusMinutes,
      todayCommitCount,
      questionNote,
    ]
  );

  const handleAddTodo = () => {
    const text = todoText.trim();
    if (!text) return;

    const nextTodo = {
      id: Date.now(),
      text,
      done: false,
      category: todoCategory,
      priority: todoPriority,
      createdAt: new Date().toISOString(),
    };

    setTodos((prev) => [nextTodo, ...prev]);
    setTodoText('');
  };

  const handleToggleTodo = (id) => {
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  };

  const handleDeleteTodo = (id) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const handleStartPomodoro = () => setIsRunning(true);
  const handlePausePomodoro = () => setIsRunning(false);
  const handleResetPomodoro = () => {
    setIsRunning(false);
    setMode('focus');
    setSecondsLeft(FOCUS_SECONDS);
  };

  const handleAddCommitLog = () => {
    const repo = repoName.trim();
    const message = commitMessage.trim();
    if (!repo || !message) return;

    const nextLog = {
      id: Date.now(),
      repo,
      message,
      createdAt: new Date().toISOString(),
    };

    setCommitLogs((prev) => [nextLog, ...prev]);
    setRepoName('');
    setCommitMessage('');
  };

  const handleDeleteCommitLog = (id) => {
    setCommitLogs((prev) => prev.filter((log) => log.id !== id));
  };

  const handleOpenChatGPT = () => {
    window.open('https://chat.openai.com/', '_blank', 'noopener,noreferrer');
  };

  const applyTemplate = (template) => {
    setQuestionNote(template);
  };

  return (
    <div className="app">
      <header className="hero card">
        <h1>Uni-Study</h1>
        <p>대학생을 위한 AI 공부 생산성 대시보드</p>
      </header>

      <main className="dashboard-grid">
        <section className="card">
          <h2>1) 개인 공부 투두리스트</h2>
          <div className="form-row">
            <input
              type="text"
              placeholder="할 일을 입력하세요"
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
            />
          </div>
          <div className="form-row multi">
            <select value={todoCategory} onChange={(e) => setTodoCategory(e.target.value)}>
              <option value="전공">전공</option>
              <option value="교양">교양</option>
              <option value="프로젝트">프로젝트</option>
              <option value="시험준비">시험준비</option>
              <option value="기타">기타</option>
            </select>
            <select value={todoPriority} onChange={(e) => setTodoPriority(e.target.value)}>
              <option value="상">우선순위: 상</option>
              <option value="중">우선순위: 중</option>
              <option value="하">우선순위: 하</option>
            </select>
            <button onClick={handleAddTodo}>할 일 추가</button>
          </div>

          <ul className="list">
            {todos.map((todo) => (
              <li key={todo.id} className={todo.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={todo.done} onChange={() => handleToggleTodo(todo.id)} />
                  <span>{todo.text}</span>
                </label>
                <small>
                  [{todo.category}] [{todo.priority}]
                </small>
                <button className="danger" onClick={() => handleDeleteTodo(todo.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>2) 뽀모도로 타이머</h2>
          <p className="mode">
            현재 모드: {mode === 'focus' ? '집중 25분' : '휴식 5분'} {isRunning ? '(진행 중)' : '(대기)'}
          </p>
          <div className="timer">{formatTime(secondsLeft)}</div>
          <div className="button-row">
            <button onClick={handleStartPomodoro}>시작</button>
            <button onClick={handlePausePomodoro}>일시정지</button>
            <button onClick={handleResetPomodoro}>초기화</button>
          </div>
          <div className="stats-row">
            <p>완료한 뽀모도로: {completedPomodoros}회</p>
            <p>총 집중 시간: {totalFocusMinutes}분</p>
          </div>
        </section>

        <section className="card">
          <h2>3) Notion Sync Ready</h2>
          <p>현재는 localStorage 기반으로 데이터가 저장됩니다.</p>
          <p>향후 Notion API 연동이 가능하도록 확장할 수 있습니다.</p>
        </section>

        <section className="card">
          <h2>4) GitHub Study Log</h2>
          <div className="form-row multi">
            <input
              type="text"
              placeholder="레포 이름 (예: uni-study)"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
            />
            <input
              type="text"
              placeholder="커밋 메시지"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
            <button onClick={handleAddCommitLog}>커밋 기록 추가</button>
          </div>
          <p>오늘 커밋 개수: {todayCommitCount}</p>
          <ul className="list">
            {commitLogs.map((log) => (
              <li key={log.id}>
                <div>
                  <strong>{log.repo}</strong> - {log.message}
                  <small> ({new Date(log.createdAt).toLocaleString()})</small>
                </div>
                <button className="danger" onClick={() => handleDeleteCommitLog(log.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <p className="muted">향후 GitHub API 연동 가능</p>
        </section>

        <section className="card">
          <h2>5) AI Study Assistant</h2>
          <div className="button-row">
            <button onClick={handleOpenChatGPT}>ChatGPT 새 창 열기</button>
          </div>
          <textarea
            rows={4}
            placeholder="질문 메모를 입력하세요"
            value={questionNote}
            onChange={(e) => setQuestionNote(e.target.value)}
          />
          <div className="template-wrap">
            {QUESTION_TEMPLATES.map((template) => (
              <button key={template} className="template-btn" onClick={() => applyTemplate(template)}>
                {template}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>6) Today Summary</h2>
          <div className="summary-grid">
            <p>완료한 할 일 개수: {completedTodoCount}</p>
            <p>전체 할 일 개수: {totalTodoCount}</p>
            <p>완료한 뽀모도로 횟수: {completedPomodoros}</p>
            <p>총 집중 시간: {totalFocusMinutes}분</p>
            <p>오늘 커밋 개수: {todayCommitCount}</p>
            <p>공부 생산성 점수: {summary.score}점</p>
          </div>
          <p className="recommendation">다음 행동 추천: {summary.recommendation}</p>
        </section>
      </main>

      <footer className="card privacy">
        <h3>개인정보 및 안내</h3>
        <ul>
          <li>입력 데이터는 현재 브라우저 localStorage에만 저장됩니다.</li>
          <li>AI 분석은 참고용이며 최종 판단은 사용자가 직접 합니다.</li>
          <li>실제 Notion/GitHub/OpenAI 연동은 향후 API 연결로 확장할 수 있습니다.</li>
        </ul>
      </footer>
    </div>
  );
}

export default App;
