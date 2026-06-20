import { useEffect, useMemo, useState } from 'react';
import './App.css';

const TODO_STORAGE_KEY = 'uni-study.todos';
const POMODORO_STORAGE_KEY = 'uni-study.pomodoro';
const GITHUB_LOG_STORAGE_KEY = 'uni-study.githubLogs';
const QUESTION_NOTE_STORAGE_KEY = 'uni-study.questionNote';
const NOTION_PLAN_STORAGE_KEY = 'uni-study.notionPlan';
const NOTION_TASKS_STORAGE_KEY = 'uni-study.notionTasks';
const SETTINGS_STORAGE_KEY = 'uni-study.settings';
const AUTH_TOKEN_STORAGE_KEY = 'uni-study.authToken';
const REFRESH_TOKEN_STORAGE_KEY = 'uni-study.refreshToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const QUESTION_TEMPLATES = [
  '이 개념 쉽게 설명해줘',
  '오늘 공부 계획 짜줘',
  '에러 원인 분석해줘',
  '이 코드를 리팩토링해줘',
];

const SECTIONS = {
  INTRO: 'intro',
  LOGIN: 'login',
  HOME: 'home',
  STUDY: 'study',
  NOTION: 'notion',
  GITHUB: 'github',
  AI: 'ai',
  SUMMARY: 'summary',
  RESOURCES: 'resources',
};

const SOCIAL_PROVIDER_META = {
  naver: { label: 'Naver' },
  google: { label: 'Google' },
  github: { label: 'GitHub' },
};

const DEFAULT_NOTION_TASKS = [
  { id: 1, text: '오늘 할 일 3개 작성하기', done: false, createdAt: new Date().toISOString() },
  { id: 2, text: '집중할 과목과 페이지 정하기', done: false, createdAt: new Date().toISOString() },
  { id: 3, text: '완료 후 체크 표시 남기기', done: false, createdAt: new Date().toISOString() },
];

function generateQuizFromMaterial({ material, difficulty, quizType, count }) {
  const cleaned = material.replace(/\s+/g, ' ').trim();
  const sentences = cleaned
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 10);

  const words = (cleaned.match(/[A-Za-z가-힣0-9]{2,}/g) || []).filter((word) => word.length >= 2);
  const uniqueWords = [...new Set(words)];

  if (!sentences.length || !uniqueWords.length) {
    return [];
  }

  const total = Math.min(count, 15);
  const questions = [];

  for (let i = 0; i < total; i += 1) {
    const baseSentence = sentences[i % sentences.length];
    const answerWord = uniqueWords[i % uniqueWords.length];
    const resolvedType =
      quizType === '자동'
        ? difficulty === '하'
          ? '객관식'
          : difficulty === '중'
          ? '빈칸'
          : '서술형'
        : quizType;

    if (resolvedType === '객관식') {
      const distractors = uniqueWords
        .filter((word) => word !== answerWord)
        .slice(i % Math.max(uniqueWords.length - 1, 1), i % Math.max(uniqueWords.length - 1, 1) + 3);

      const choices = [answerWord, ...distractors].slice(0, 4);
      const questionPrefix = difficulty === '상' ? '다음 내용을 가장 정확하게 대표하는 키워드를 고르세요.' : '다음 문장과 가장 관련 있는 키워드는 무엇인가요?';

      questions.push({
        id: `${Date.now()}-easy-${i}`,
        type: '객관식',
        question: `${questionPrefix}\n"${baseSentence}"`,
        choices,
        answer: answerWord,
      });
      continue;
    }

    if (resolvedType === '빈칸') {
      const blanked = baseSentence.includes(answerWord)
        ? baseSentence.replace(answerWord, '____')
        : `${baseSentence} (핵심어: ____ )`;
      const prompt = difficulty === '하'
        ? '다음 문장의 빈칸에 들어갈 핵심어를 채우세요.'
        : difficulty === '상'
        ? '다음 문장을 참고해 가장 적절한 핵심어를 추론해 작성하세요.'
        : '다음 문장의 빈칸에 들어갈 가장 적절한 단어를 작성하세요.';

      questions.push({
        id: `${Date.now()}-mid-${i}`,
        type: '빈칸',
        question: `${prompt}\n${blanked}`,
        choices: [],
        answer: answerWord,
      });
      continue;
    }

    const essayGuide =
      difficulty === '하'
        ? '핵심 개념을 1~2문장으로 설명하세요.'
        : difficulty === '중'
        ? '핵심 개념을 2~3문장으로 설명하세요.'
        : '핵심 개념과 적용 예시를 3문장 이상으로 설명하세요.';

    questions.push({
      id: `${Date.now()}-hard-${i}`,
      type: '서술형',
      question: `${essayGuide}\n핵심어: ${answerWord}`,
      choices: [],
      answer: baseSentence,
    });
  }

  return questions;
}

async function authApiRequest(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Authentication request failed.');
  }

  return data;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) {
    throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    throw new Error(data.message || '세션이 만료되었습니다. 다시 로그인해주세요.');
  }

  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
  }

  return data.token;
}

async function authenticatedApiRequest(endpoint, options = {}) {
  const method = options.method || 'GET';
  const payload = options.body;

  const runRequest = async (token) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const accessToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!accessToken) {
    throw new Error('로그인이 필요합니다.');
  }

  let { response, data } = await runRequest(accessToken);

  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    ({ response, data } = await runRequest(refreshedToken));
  }

  if (!response.ok) {
    throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
  }

  return data;
}

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
  const date = new Date(isoDate);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getHeatLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// AI 기반 공모전 & 대외활동 추천
function recommendOpportunities({
  category,
  completedPomodoros,
  totalFocusMinutes,
}) {
  const opportunities = {
    공모전: [
      {
        title: '2026 코드게이트 AI 스타트업 해커톤',
        icon: '🤖',
        link: 'https://linkareer.com/activity/322760',
        description: 'AI 기반 제품/서비스 아이디어를 팀으로 검증하는 해커톤',
        difficulty: '중급',
      },
      {
        title: '[국립중앙도서관] 2026 도서관 데이터 활용 공모전',
        icon: '📊',
        link: 'https://linkareer.com/activity/324762',
        description: '공공 데이터 기반 문제 해결 아이디어를 제안하는 공모전',
        difficulty: '상급',
      },
      {
        title: '2026년 연구실 안전 콘텐츠 및 우수사례 공모전',
        icon: '🏆',
        link: 'https://www.contestkorea.com/sub/view.php?int_gbn=1&Txt_bcode=030310001&str_no=202606090018',
        description: '과학기술정보통신부 주최, 2026년 접수 공고 기준 최신 모집',
        difficulty: '중급',
      },
    ],
    인턴십: [
      {
        title: '링커리어 채용/인턴 최신 공고',
        icon: '🧭',
        link: 'https://linkareer.com/recruit-home',
        description: '대학생/신입 대상 최신 인턴 공고를 모아보는 페이지',
        difficulty: '상급',
      },
      {
        title: '원티드 인턴 채용 모음',
        icon: '💼',
        link: 'https://www.wanted.co.kr/search?query=%EC%9D%B8%ED%84%B4&tab=position',
        description: 'IT/기획/디자인 등 직무별 최신 인턴 포지션 탐색',
        difficulty: '상급',
      },
      {
        title: '잡코리아 인턴 채용관',
        icon: '🚀',
        link: 'https://www.jobkorea.co.kr/recruit/joblist?menucode=duty&duty=1000230',
        description: '기업 규모별 인턴 채용 공고를 최신순으로 확인',
        difficulty: '중급',
      },
    ],
  };

  // 학습 강도에 따라 난이도 추천
  let recommendedLevel = '중급';
  if (completedPomodoros >= 5 && totalFocusMinutes >= 240) {
    recommendedLevel = '상급';
  } else if (completedPomodoros <= 1 || totalFocusMinutes <= 60) {
    recommendedLevel = '초급';
  }

  const categoryOpportunities = opportunities[category] || opportunities.공모전;
  
  // 추천 난이도에 맞는 기회 필터링
  const filtered = categoryOpportunities.filter(
    (opp) => opp.difficulty === recommendedLevel || recommendedLevel === '중급'
  );

  return filtered.length > 0 ? filtered : categoryOpportunities;
}

function App() {
  const [selectedSection, setSelectedSection] = useState(SECTIONS.INTRO);

  // 개인 공부(투두)
  const [todos, setTodos] = useState(() => {
    const savedTodos = safeParse(localStorage.getItem(TODO_STORAGE_KEY), []);
    return Array.isArray(savedTodos) ? savedTodos : [];
  });
  const [todoText, setTodoText] = useState('');
  const [todoCategory, setTodoCategory] = useState('전공');
  const [todoPriority, setTodoPriority] = useState('중');

  // 뽀모도로
  const [mode, setMode] = useState(() => {
    const savedPomodoro = safeParse(localStorage.getItem(POMODORO_STORAGE_KEY), null);
    return savedPomodoro?.mode === 'break' ? 'break' : 'focus';
  }); // focus | break
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const savedPomodoro = safeParse(localStorage.getItem(POMODORO_STORAGE_KEY), null);
    if (!savedPomodoro) return FOCUS_SECONDS;
    if (Number.isInteger(savedPomodoro.secondsLeft)) return savedPomodoro.secondsLeft;
    return savedPomodoro.mode === 'break' ? BREAK_SECONDS : FOCUS_SECONDS;
  });
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(() => {
    const savedPomodoro = safeParse(localStorage.getItem(POMODORO_STORAGE_KEY), null);
    return Number.isInteger(savedPomodoro?.completedPomodoros)
      ? savedPomodoro.completedPomodoros
      : 0;
  });
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(() => {
    const savedPomodoro = safeParse(localStorage.getItem(POMODORO_STORAGE_KEY), null);
    return Number.isInteger(savedPomodoro?.totalFocusMinutes)
      ? savedPomodoro.totalFocusMinutes
      : 0;
  });

  // Notion Sync
  const [notionPlan, setNotionPlan] = useState(
    () => localStorage.getItem(NOTION_PLAN_STORAGE_KEY) || ''
  );
  const [notionTasks, setNotionTasks] = useState(() => {
    const savedNotionTasks = safeParse(
      localStorage.getItem(NOTION_TASKS_STORAGE_KEY),
      DEFAULT_NOTION_TASKS
    );
    return Array.isArray(savedNotionTasks) ? savedNotionTasks : DEFAULT_NOTION_TASKS;
  });
  const [notionTaskText, setNotionTaskText] = useState('');

  // GitHub Study Log
  const [repoName, setRepoName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [commitLogs, setCommitLogs] = useState(() => {
    const savedGithubLogs = safeParse(localStorage.getItem(GITHUB_LOG_STORAGE_KEY), []);
    return Array.isArray(savedGithubLogs) ? savedGithubLogs : [];
  });

  // AI Study Assistant
  const [questionNote, setQuestionNote] = useState(
    () => localStorage.getItem(QUESTION_NOTE_STORAGE_KEY) || ''
  );
  const [promptTopic, setPromptTopic] = useState('React 상태 관리');
  const [promptTaskType, setPromptTaskType] = useState('개념 설명');
  const [promptLevel, setPromptLevel] = useState('초급');
  const [promptFormat, setPromptFormat] = useState('체크리스트');
  const [copilotRoles, setCopilotRoles] = useState([]);
  const [copilotRole, setCopilotRole] = useState('general');
  const [copilotReply, setCopilotReply] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState('');
  const [copilotHistory, setCopilotHistory] = useState([]);

  // Home header tools
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_STORAGE_KEY), null);
    return Boolean(savedSettings?.darkModeEnabled);
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_STORAGE_KEY), null);
    return savedSettings?.notificationsEnabled !== false;
  });
  const [appLanguage, setAppLanguage] = useState(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_STORAGE_KEY), null);
    return savedSettings?.appLanguage === 'en' ? 'en' : 'ko';
  });

  // Login
  const [authMode, setAuthMode] = useState('signin');
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupId, setSignupId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordCheck, setSignupPasswordCheck] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoginLoading, setSocialLoginLoading] = useState('');

  // Study Quiz Generator (6번 카드)
  const [quizMaterial, setQuizMaterial] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('중');
  const [quizType, setQuizType] = useState('자동');
  const [quizCount, setQuizCount] = useState('5');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizFileName, setQuizFileName] = useState('');
  const [quizError, setQuizError] = useState('');

  // 공모전 & 대외활동 추천 (6번 카드 - 변경)
  const [opportunityCategory, setOpportunityCategory] = useState('공모전');
  const [opportunityRecommendations, setOpportunityRecommendations] = useState([]);
  const [isSyncReady, setIsSyncReady] = useState(
    () => !localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  );

  // 초기 로드
  useEffect(() => {
    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;

    authenticatedApiRequest('/api/study/sync')
      .then((data) => {
        if (!data) return;

        if (Array.isArray(data.todos)) setTodos(data.todos);
        if (Array.isArray(data.commitLogs)) setCommitLogs(data.commitLogs);
        if (typeof data.questionNote === 'string') setQuestionNote(data.questionNote);
        if (typeof data.notionPlan === 'string') setNotionPlan(data.notionPlan);
        if (Array.isArray(data.notionTasks)) setNotionTasks(data.notionTasks);

        if (data.pomodoro && typeof data.pomodoro === 'object') {
          setMode(data.pomodoro.mode === 'break' ? 'break' : 'focus');
          setSecondsLeft(Number.isInteger(data.pomodoro.secondsLeft) ? data.pomodoro.secondsLeft : FOCUS_SECONDS);
          setCompletedPomodoros(Number.isInteger(data.pomodoro.completedPomodoros) ? data.pomodoro.completedPomodoros : 0);
          setTotalFocusMinutes(Number.isInteger(data.pomodoro.totalFocusMinutes) ? data.pomodoro.totalFocusMinutes : 0);
        }
      })
      .catch(() => {})
      .finally(() => setIsSyncReady(true));
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

  useEffect(() => {
    localStorage.setItem(NOTION_PLAN_STORAGE_KEY, notionPlan);
  }, [notionPlan]);

  useEffect(() => {
    localStorage.setItem(NOTION_TASKS_STORAGE_KEY, JSON.stringify(notionTasks));
  }, [notionTasks]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        darkModeEnabled,
        notificationsEnabled,
        appLanguage,
      })
    );
  }, [darkModeEnabled, notificationsEnabled, appLanguage]);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', darkModeEnabled);
  }, [darkModeEnabled]);

  useEffect(() => {
    document.documentElement.lang = appLanguage === 'en' ? 'en' : 'ko';
  }, [appLanguage]);

  useEffect(() => {
    if (!isSyncReady) return undefined;

    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return undefined;

    const timer = setTimeout(() => {
      authenticatedApiRequest('/api/study/sync', {
        method: 'PUT',
        body: {
          todos,
          pomodoro: {
            mode,
            secondsLeft,
            completedPomodoros,
            totalFocusMinutes,
          },
          commitLogs,
          notionPlan,
          notionTasks,
          questionNote,
        },
      }).catch(() => {});
    }, 700);

    return () => clearTimeout(timer);
  }, [
    isSyncReady,
    todos,
    mode,
    secondsLeft,
    completedPomodoros,
    totalFocusMinutes,
    commitLogs,
    notionPlan,
    notionTasks,
    questionNote,
  ]);

  // 뽀모도로 타이머
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

  // 파생 데이터
  const completedTodoCount = useMemo(() => todos.filter((todo) => todo.done).length, [todos]);
  const totalTodoCount = todos.length;
  const completedNotionTaskCount = useMemo(
    () => notionTasks.filter((task) => task.done).length,
    [notionTasks]
  );
  const totalNotionTaskCount = notionTasks.length;
  const todayCommitCount = useMemo(
    () => commitLogs.filter((log) => isToday(log.createdAt)).length,
    [commitLogs]
  );

  const commitHeatmapByMonth = useMemo(() => {
    const byDay = commitLogs.reduce((acc, log) => {
      const date = new Date(log.createdAt);
      const key = toDateKey(date);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const now = new Date();
    const monthFormatter = new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
    });
    const months = [];

    for (let monthOffset = 2; monthOffset >= 0; monthOffset -= 1) {
      const baseDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const blanks = Array.from({ length: firstDay.getDay() }, (_, index) => ({
        id: `${year}-${month + 1}-blank-${index}`,
        blank: true,
      }));

      const days = [];

      for (let day = 1; day <= lastDay.getDate(); day += 1) {
        const date = new Date(year, month, day);
        const key = toDateKey(date);
        const count = byDay[key] || 0;

        days.push({
          id: key,
          key,
          day,
          count,
          level: getHeatLevel(count),
        });
      }

      months.push({
        id: `${year}-${month + 1}`,
        label: monthFormatter.format(firstDay),
        cells: [...blanks, ...days],
      });
    }

    return months;
  }, [commitLogs]);

  const recommendations = useMemo(
    () =>
      recommendOpportunities({
        category: opportunityCategory,
        completedPomodoros,
        totalFocusMinutes,
      }),
    [opportunityCategory, completedPomodoros, totalFocusMinutes]
  );

  const goHome = () => setSelectedSection(SECTIONS.HOME);

  // 투두
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

  // 뽀모도로
  const handleStartPomodoro = () => setIsRunning(true);
  const handlePausePomodoro = () => setIsRunning(false);
  const handleResetPomodoro = () => {
    setIsRunning(false);
    setMode('focus');
    setSecondsLeft(FOCUS_SECONDS);
  };

  // GitHub
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

  // Notion
  const handleAddNotionTask = () => {
    const text = notionTaskText.trim();
    if (!text) return;

    const nextTask = {
      id: Date.now(),
      text,
      done: false,
      createdAt: new Date().toISOString(),
    };

    setNotionTasks((prev) => [nextTask, ...prev]);
    setNotionTaskText('');
  };

  const handleToggleNotionTask = (id) => {
    setNotionTasks((prev) => prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  const handleDeleteNotionTask = (id) => {
    setNotionTasks((prev) => prev.filter((task) => task.id !== id));
  };

  // AI
  const handleOpenChatGPT = () => {
    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  };

  const applyTemplate = (template) => {
    setQuestionNote(template);
  };

  const handleGeneratePromptTemplate = () => {
    const topic = promptTopic.trim() || '학습 주제';

    const template = [
      `너는 대학생 학습 코치야.`,
      `주제: ${topic}`,
      `요청 유형: ${promptTaskType}`,
      `난이도: ${promptLevel}`,
      `출력 형식: ${promptFormat}`,
      '',
      '아래 형식으로 답변해줘:',
      '1) 핵심 요약 (3줄 이내)',
      '2) 지금 바로 할 수 있는 학습 액션 3개',
      '3) 헷갈리기 쉬운 포인트 2개',
      '4) 복습용 체크 질문 2개',
    ].join('\n');

    setQuestionNote(template);
  };

  const handleResetPromptTemplate = () => {
    setPromptTopic('');
    setPromptTaskType('개념 설명');
    setPromptLevel('초급');
    setPromptFormat('체크리스트');
    setQuestionNote('');
  };

  useEffect(() => {
    if (selectedSection !== SECTIONS.AI) return;
    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;

    authenticatedApiRequest('/api/copilot/roles')
      .then((data) => {
        const roles = Array.isArray(data.roles) ? data.roles : [];
        setCopilotRoles(roles);
        if (!roles.some((role) => role.id === copilotRole) && roles[0]?.id) {
          setCopilotRole(roles[0].id);
        }
      })
      .catch((error) => {
        setCopilotError(error.message);
      });
  }, [selectedSection, copilotRole]);

  const handleAskCopilot = async () => {
    const message = questionNote.trim();
    if (!message) {
      setCopilotError('질문 내용을 입력해주세요.');
      return;
    }

    try {
      setCopilotLoading(true);
      setCopilotError('');

      const history = copilotHistory.slice(-6);
      const data = await authenticatedApiRequest('/api/copilot/chat', {
        method: 'POST',
        body: {
          roleId: copilotRole,
          message,
          context: `topic=${promptTopic}; taskType=${promptTaskType}; level=${promptLevel}; format=${promptFormat}`,
          history,
        },
      });

      setCopilotReply(data.reply || '응답이 비어 있습니다.');
      setCopilotHistory((prev) => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data.reply || '' },
      ]);
    } catch (error) {
      setCopilotError(error.message);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleQuizFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setQuizMaterial(text);
      setQuizFileName(file.name);
      setQuizError('');
      setQuizQuestions([]);
    } catch {
      setQuizError('파일을 읽는 중 오류가 발생했습니다. 다른 파일을 시도해보세요.');
    } finally {
      event.target.value = '';
    }
  };

  const handleGenerateQuiz = () => {
    const material = quizMaterial.trim();
    const requestedCount = Number.parseInt(quizCount, 10);

    if (material.length < 20) {
      setQuizError('자료를 조금 더 입력해주세요. (최소 20자 이상)');
      setQuizQuestions([]);
      return;
    }

    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 15) {
      setQuizError('문제 수는 1~15 사이 숫자로 입력해주세요.');
      setQuizQuestions([]);
      return;
    }

    const generated = generateQuizFromMaterial({
      material,
      difficulty: quizDifficulty,
      quizType,
      count: requestedCount,
    });

    if (!generated.length) {
      setQuizError('자료에서 문제를 만들기 어려워요. 문장을 더 구체적으로 넣어주세요.');
      setQuizQuestions([]);
      return;
    }

    setQuizError('');
    setQuizQuestions(generated);
  };

  const handleResetQuiz = () => {
    setQuizMaterial('');
    setQuizDifficulty('중');
    setQuizType('자동');
    setQuizCount('5');
    setQuizQuestions([]);
    setQuizFileName('');
    setQuizError('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');

    const id = loginId.trim();
    const password = loginPassword.trim();

    if (!id || !password) {
      setLoginError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setAuthLoading(true);
      const data = await authApiRequest('/api/auth/login', { username: id, password });

      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
      if (data.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
      }
      setLoginId(data.user.username);
      setLoginPassword('');
      setSelectedSection(SECTIONS.HOME);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    const name = signupName.trim();
    const id = signupId.trim();
    const password = signupPassword.trim();
    const passwordCheck = signupPasswordCheck.trim();

    if (!name || !id || !password || !passwordCheck) {
      setLoginError('Please fill in name, username, and password.');
      return;
    }

    if (password.length < 4) {
      setLoginError('Password must be at least 4 characters.');
      return;
    }

    if (password !== passwordCheck) {
      setLoginError('Password confirmation does not match.');
      return;
    }

    try {
      setAuthLoading(true);
      const data = await authApiRequest('/api/auth/signup', {
        name,
        username: id,
        password,
      });

      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
      if (data.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
      }
      setLoginError('');
      setLoginId(data.user.username);
      setLoginPassword('');
      setSignupName('');
      setSignupId('');
      setSignupPassword('');
      setSignupPasswordCheck('');
      setSelectedSection(SECTIONS.HOME);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialLogin = (providerKey) => {
    const providerLabel = SOCIAL_PROVIDER_META[providerKey]?.label || 'Social';

    setLoginError('');
    setLoginId(`${providerLabel} user`);
    setLoginPassword('');
    setSocialLoginLoading('');
    setSelectedSection(SECTIONS.HOME);
  };

  const renderIntro = () => (
    <section className="intro-screen">
      <div className="intro-orb orb-a" aria-hidden="true" />
      <div className="intro-orb orb-b" aria-hidden="true" />
      <div className="intro-orb orb-c" aria-hidden="true" />

      <div className="intro-card">
        <p className="intro-tag">Welcome To</p>
        <h1 className="intro-logo">Uni-Study</h1>
        <p className="intro-subtitle">대학생을 위한 AI 루틴 어플</p>
        <button className="intro-start" onClick={() => setSelectedSection(SECTIONS.LOGIN)}>
          Start
        </button>
      </div>
    </section>
  );

  const renderLogin = () => (
    <section className="login-screen">
      <div className="intro-orb orb-a" aria-hidden="true" />
      <div className="intro-orb orb-b" aria-hidden="true" />

      <div className="login-card">
        <p className="intro-tag">Sign In</p>
        <h1 className="login-title">Uni-Study Login</h1>
        <p className="intro-subtitle">Sign in to your account.</p>

        <div className="login-layout">
          <aside className="social-panel">
            <p className="social-title">Social Login</p>
            <div className="social-buttons">
              <button
                type="button"
                className="social-btn naver"
                disabled={Boolean(socialLoginLoading)}
                onClick={() => handleSocialLogin('naver')}
              >
                {socialLoginLoading === 'naver' ? 'Signing in...' : 'Continue with Naver'}
              </button>
              <button
                type="button"
                className="social-btn google"
                disabled={Boolean(socialLoginLoading)}
                onClick={() => handleSocialLogin('google')}
              >
                {socialLoginLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
              </button>
              <button
                type="button"
                className="social-btn github"
                disabled={Boolean(socialLoginLoading)}
                onClick={() => handleSocialLogin('github')}
              >
                {socialLoginLoading === 'github' ? 'Signing in...' : 'Continue with GitHub'}
              </button>
            </div>
          </aside>

          <section className="auth-panel">
            <div className="auth-mode-tabs">
              <button
                type="button"
                className={authMode === 'signin' ? 'tab-btn active' : 'tab-btn'}
                onClick={() => {
                  setAuthMode('signin');
                  setLoginError('');
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={authMode === 'signup' ? 'tab-btn active' : 'tab-btn'}
                onClick={() => {
                  setAuthMode('signup');
                  setLoginError('');
                }}
              >
                Sign Up
              </button>
            </div>

            {authMode === 'signin' && (
              <form className="login-form" onSubmit={handleLogin}>
                <input
                  id="login-id"
                  type="text"
                  aria-label="Username"
                  placeholder="Enter username"
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  disabled={authLoading}
                />

                <input
                  id="login-password"
                  type="password"
                  aria-label="Password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  disabled={authLoading}
                />

                {loginError && <p className="login-error">{loginError}</p>}

                <div className="login-actions">
                  <button type="submit" disabled={authLoading}>{authLoading ? 'Signing In...' : 'Sign In'}</button>
                  <button type="button" className="btn-control btn-reset login-back" onClick={() => setSelectedSection(SECTIONS.INTRO)} disabled={authLoading}>
                    Back
                  </button>
                </div>
              </form>
            )}

            {authMode === 'signup' && (
              <form className="login-form" onSubmit={handleSignup}>
                <label htmlFor="signup-name">Name</label>
                <input
                  id="signup-name"
                  type="text"
                  placeholder="Enter name"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  disabled={authLoading}
                />

                <label htmlFor="signup-id">Username</label>
                <input
                  id="signup-id"
                  type="text"
                  placeholder="Create username"
                  value={signupId}
                  onChange={(event) => setSignupId(event.target.value)}
                  disabled={authLoading}
                />

                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  placeholder="Create password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  disabled={authLoading}
                />

                <label htmlFor="signup-password-check">Confirm Password</label>
                <input
                  id="signup-password-check"
                  type="password"
                  placeholder="Re-enter password"
                  value={signupPasswordCheck}
                  onChange={(event) => setSignupPasswordCheck(event.target.value)}
                  disabled={authLoading}
                />

                {loginError && <p className="login-error">{loginError}</p>}

                <div className="login-actions">
                  <button type="submit" disabled={authLoading}>{authLoading ? 'Creating...' : 'Create Account'}</button>
                  <button type="button" className="btn-control btn-reset login-back" onClick={() => setSelectedSection(SECTIONS.INTRO)} disabled={authLoading}>
                    Back
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </section>
  );

  const renderHome = () => {
    const isEnglish = appLanguage === 'en';

    return (
    <>
      <header className="hero">
        <div className="hero-top">
          <div className="hero-copy">
            <h1>Uni-Study</h1>
            <p>{isEnglish ? 'AI routine app for university students' : '대학생을 위한 AI 루틴 어플'}</p>
          </div>

          <div className="hero-toolbox">
            <div className="hero-toc-wrap">
              <button
                type="button"
                className="toc-icon-btn"
                aria-expanded={isTocOpen}
                aria-label="목차 열기"
                onClick={() => {
                  setIsTocOpen((prev) => !prev);
                  setIsSettingsOpen(false);
                }}
              >
                ☰
              </button>

              {isTocOpen && (
                <div className="toc-menu">
                  <button type="button" onClick={() => setSelectedSection(SECTIONS.STUDY)}>{isEnglish ? '1) Personal Study' : '1) 개인 공부'}</button>
                  <button type="button" onClick={() => setSelectedSection(SECTIONS.NOTION)}>2) Notion Sync</button>
                  <button type="button" onClick={() => setSelectedSection(SECTIONS.GITHUB)}>3) GitHub Study Log</button>
                  <button type="button" onClick={() => setSelectedSection(SECTIONS.AI)}>4) AI Study Assistant</button>
                  <button type="button" onClick={() => setSelectedSection(SECTIONS.SUMMARY)}>5) Quiz Generator</button>
                  <button type="button" onClick={() => setSelectedSection(SECTIONS.RESOURCES)}>{isEnglish ? '6) Contest & Activities' : '6) 공모전 & 대외활동'}</button>
                </div>
              )}
            </div>

            <div className="hero-settings-wrap">
              <button
                type="button"
                className="friend-icon-btn"
                aria-label="설정 아이콘"
                aria-expanded={isSettingsOpen}
                onClick={() => {
                  setIsSettingsOpen((prev) => !prev);
                  setIsTocOpen(false);
                }}
              >
                ⚙️
              </button>

              {isSettingsOpen && (
                <div className="settings-menu">
                  <h4>{isEnglish ? 'Settings' : '설정'}</h4>

                  <label className="settings-item" htmlFor="setting-dark-mode">
                    <span>{isEnglish ? 'Dark Mode' : '다크 모드 전환'}</span>
                    <input
                      id="setting-dark-mode"
                      type="checkbox"
                      checked={darkModeEnabled}
                      onChange={(event) => setDarkModeEnabled(event.target.checked)}
                    />
                  </label>

                  <label className="settings-item" htmlFor="setting-notification">
                    <span>{isEnglish ? 'Notifications' : '알림 설정'}</span>
                    <input
                      id="setting-notification"
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(event) => setNotificationsEnabled(event.target.checked)}
                    />
                  </label>

                  <label className="settings-item select" htmlFor="setting-language">
                    <span>{isEnglish ? 'Language' : '언어 변경'}</span>
                    <select
                      id="setting-language"
                      value={appLanguage}
                      onChange={(event) => setAppLanguage(event.target.value)}
                    >
                      <option value="ko">한국어</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="dashboard-grid home-grid">
        <button className="card nav-card" onClick={() => setSelectedSection(SECTIONS.STUDY)}>
          <div className="nav-top">
            <span className="nav-icon" aria-hidden="true">📚</span>
            <span className="nav-kicker">Learning Core</span>
          </div>
          <h2>{isEnglish ? '1) Personal Study' : '1) 개인 공부'}</h2>
          <p>{isEnglish ? 'Manage your study routine with todos and Pomodoro' : '투두리스트와 뽀모도로로 오늘 학습 루틴 관리'}</p>
        </button>

        <button className="card nav-card" onClick={() => setSelectedSection(SECTIONS.NOTION)}>
          <div className="nav-top">
            <span className="nav-icon" aria-hidden="true">📝</span>
            <span className="nav-kicker">Planning</span>
          </div>
          <h2>2) Notion Sync</h2>
          <p>{isEnglish ? 'Write and store your Notion-style study plan' : 'Notion 스타일 공부 계획 작성 및 저장'}</p>
          <span className="nav-meta">{isEnglish ? `Checklist ${completedNotionTaskCount}/${totalNotionTaskCount} done` : `체크리스트 ${completedNotionTaskCount}/${totalNotionTaskCount} 완료`}</span>
        </button>

        <button className="card nav-card" onClick={() => setSelectedSection(SECTIONS.GITHUB)}>
          <div className="nav-top">
            <span className="nav-icon" aria-hidden="true">💻</span>
            <span className="nav-kicker">Tracking</span>
          </div>
          <h2>3) GitHub Study Log</h2>
          <p>{isEnglish ? 'Track your progress with commit-based logs' : '커밋 기반 학습 기록 정리'}</p>
          <span className="nav-meta">{isEnglish ? `Today commits ${todayCommitCount} · logs ${commitLogs.length}` : `오늘 커밋 ${todayCommitCount}개 · 로그 ${commitLogs.length}개`}</span>
        </button>

        <button className="card nav-card" onClick={() => setSelectedSection(SECTIONS.AI)}>
          <div className="nav-top">
            <span className="nav-icon" aria-hidden="true">🤖</span>
            <span className="nav-kicker">Assistant</span>
          </div>
          <h2>4) AI Study Assistant</h2>
          <p>{isEnglish ? 'Prepare AI prompts with templates and notes' : '질문 템플릿과 메모로 AI 질의 준비'}</p>
        </button>

        <button className="card nav-card summary-nav" onClick={() => setSelectedSection(SECTIONS.SUMMARY)}>
          <div className="nav-top">
            <span className="nav-icon" aria-hidden="true">�</span>
            <span className="nav-kicker">Resource Hub</span>
          </div>
          <h2>5) Quiz Generator</h2>
          <p>{isEnglish ? 'Create quizzes from your material by level and count' : '공부 자료를 넣고 난이도/문항 수를 선택해 퀴즈 생성'}</p>
        </button>

        <button className="card nav-card" onClick={() => setSelectedSection(SECTIONS.RESOURCES)}>
          <div className="nav-top">
            <span className="nav-icon" aria-hidden="true">🏆</span>
            <span className="nav-kicker">Opportunities</span>
          </div>
          <h2>{isEnglish ? '6) Contest & Activities' : '6) 공모전 & 대외활동'}</h2>
          <p>{isEnglish ? 'AI recommends contests and internships based on your study style' : 'AI가 당신의 학습 스타일에 맞는 공모전과 인턴십을 추천해드립니다'}</p>
        </button>
      </main>
    </>
  );
  };

  const renderStudy = () => (
    <section className="card section-screen">
      <div className="section-head">
        <h2>개인 공부 화면</h2>
        <button onClick={goHome}>뒤로가기</button>
      </div>

      <div className="section-split">
        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">✅</span>투두리스트</h3>
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

          <ul className="list todo-list">
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
        </div>

        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">⏱️</span>뽀모도로 타이머</h3>
          
          <div className={`pomodoro-container ${mode}`}>
            <div className="timer-ring-wrapper">
              <svg className="timer-ring" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" className="timer-ring-bg" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  className="timer-ring-progress"
                  style={{
                    strokeDasharray: `${(mode === 'focus' ? (1500 - secondsLeft) / 1500 : (300 - secondsLeft) / 300) * 2 * 45 * Math.PI} ${2 * 45 * Math.PI}`
                  }}
                />
              </svg>
              <div className="timer-display">
                <div className="timer-time">{formatTime(secondsLeft)}</div>
                <div className="timer-mode">
                  {mode === 'focus' ? '🎯 집중' : '☕ 휴식'}
                </div>
              </div>
            </div>

            <div className="pomodoro-status">
              <p className="status-text">{isRunning ? '⏳ 진행 중...' : '⏸️ 대기 중'}</p>
            </div>

            <div className="button-row pomodoro-controls">
              <button onClick={handleStartPomodoro} className={`btn-control ${isRunning ? 'disabled' : ''}`}>
                {isRunning ? '진행 중' : '시작'}
              </button>
              <button onClick={handlePausePomodoro} className={`btn-control ${!isRunning ? 'disabled' : ''}`}>
                일시정지
              </button>
              <button onClick={handleResetPomodoro} className="btn-control btn-reset">초기화</button>
            </div>

            <div className="stats-row pomodoro-stats">
              <div className="stat-item">
                <span className="stat-label">완료</span>
                <span className="stat-value">{completedPomodoros}회</span>
              </div>
              <div className="stat-divider">•</div>
              <div className="stat-item">
                <span className="stat-label">집중</span>
                <span className="stat-value">{totalFocusMinutes}분</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderNotion = () => (
    <section className="card section-screen">
      <div className="section-head">
        <h2>Notion Sync 화면</h2>
        <div className="section-actions">
          <a className="section-link" href="https://www.notion.so/" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">🗒️</span>
            Notion 열기
          </a>
          <button onClick={goHome}>뒤로가기</button>
        </div>
      </div>

      <div className="section-split">
        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🗂️</span>노션 페이지 소개</h3>
          <p>실제 Notion 앱과 웹으로 바로 열 수 있도록 링크를 연결했습니다.</p>
          <div className="section-link-group">
            <a className="section-link secondary" href="notion://www.notion.so/" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">📱</span>
              Notion 앱 열기
            </a>
            <a className="section-link secondary" href="https://www.notion.so/" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">✨</span>
              Notion 웹 접속
            </a>
            <a className="section-link secondary" href="https://www.notion.so/templates" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">📚</span>
              템플릿 보기
            </a>
          </div>
          <div className="summary-pill-row">
            <span className="summary-pill">전체 {totalNotionTaskCount}개</span>
            <span className="summary-pill">완료 {completedNotionTaskCount}개</span>
          </div>
          <p className="muted">체크리스트는 localStorage에 저장되고, 홈 카드의 요약 수치도 함께 갱신됩니다.</p>
          <div className="resource-section">
            <h4>사용 흐름</h4>
            <ul className="resource-list">
              <li>노션 링크를 눌러 실제 페이지 또는 웹앱을 엽니다.</li>
              <li>아래 체크리스트를 작성하고 체크합니다.</li>
              <li>작성 결과는 2번 카드와 이 화면의 요약에 반영됩니다.</li>
            </ul>
          </div>
        </div>

        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🧾</span>오늘의 체크리스트</h3>
          <div className="form-row multi notion-add-row">
            <input
              type="text"
              placeholder="오늘 할 일을 추가하세요"
              value={notionTaskText}
              onChange={(e) => setNotionTaskText(e.target.value)}
            />
            <button onClick={handleAddNotionTask}>추가</button>
          </div>

          <ul className="list notion-list">
            {notionTasks.map((task) => (
              <li key={task.id} className={task.done ? 'done notion-done' : 'notion-item'}>
                <label className="notion-task-label">
                  <input type="checkbox" checked={task.done} onChange={() => handleToggleNotionTask(task.id)} />
                  <span>{task.text}</span>
                </label>
                <button className="danger" onClick={() => handleDeleteNotionTask(task.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>

          <h3 className="pane-title notion-note-title"><span className="pane-icon" aria-hidden="true">🖊️</span>페이지 메모</h3>
          <textarea
            rows={8}
            placeholder="오늘의 공부 계획을 메모하세요. 예: 알고리즘 2문제, React 복습, 프로젝트 커밋 1회"
            value={notionPlan}
            onChange={(e) => setNotionPlan(e.target.value)}
          />
        </div>
      </div>
    </section>
  );

  const renderGithub = () => (
    <section className="card section-screen">
      <div className="section-head">
        <h2>GitHub Study Log 화면</h2>
        <div className="section-actions">
          <a className="section-link" href="https://github.com/" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">💻</span>
            GitHub 열기
          </a>
          <button onClick={goHome}>뒤로가기</button>
        </div>
      </div>

      <div className="section-split">
        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">✍️</span>커밋 입력</h3>
          <div className="section-link-group">
            <a className="section-link secondary" href="https://github.com/" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">⭐</span>
              GitHub 웹 접속
            </a>
            <a className="section-link secondary" href="https://docs.github.com/" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">📘</span>
              GitHub Docs
            </a>
          </div>
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
          <p>저장된 로그: {commitLogs.length}개</p>
          <p className="muted">향후 GitHub API 연동 가능</p>
        </div>

        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🌱</span>로그 캘린더</h3>
          <p className="muted">매일 커밋이 저장되면 해당 날짜 칸이 진하게 채워집니다.</p>

          <div className="month-heatmap-wrap" role="img" aria-label="월별 커밋 달력">
            {commitHeatmapByMonth.map((month) => (
              <section key={month.id} className="month-heatmap-card">
                <h4>{month.label}</h4>
                <div className="month-weekdays" aria-hidden="true">
                  <span>일</span>
                  <span>월</span>
                  <span>화</span>
                  <span>수</span>
                  <span>목</span>
                  <span>금</span>
                  <span>토</span>
                </div>
                <div className="month-heatmap-grid">
                  {month.cells.map((cell) =>
                    cell.blank ? (
                      <span key={cell.id} className="heat-cell blank" aria-hidden="true" />
                    ) : (
                      <button
                        key={cell.id}
                        type="button"
                        className={`heat-cell lv-${cell.level}`}
                        title={`${cell.key} · ${cell.count} commits`}
                      >
                        <span className="sr-only">{`${cell.key} ${cell.count} commits`}</span>
                      </button>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="heatmap-legend" aria-hidden="true">
            <span>적음</span>
            <i className="heat-cell lv-0" />
            <i className="heat-cell lv-1" />
            <i className="heat-cell lv-2" />
            <i className="heat-cell lv-3" />
            <i className="heat-cell lv-4" />
            <span>많음</span>
          </div>

          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🧰</span>커밋 로그</h3>
          <ul className="list commit-list">
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
        </div>
      </div>
    </section>
  );

  const renderAI = () => (
    <section className="card section-screen">
      <div className="section-head">
        <h2>AI Study Assistant 화면</h2>
        <button onClick={goHome}>뒤로가기</button>
      </div>

      <div className="section-split ai-clean-split">
        <div className="section-pane card ai-tools-pane">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🧭</span>빠른 시작</h3>
          <p className="ai-helper-text">템플릿으로 질문을 만들고, Copilot SDK로 바로 실행하세요.</p>

          <div className="ai-tool-card">
            <p className="ai-tool-title">외부 도구</p>
            <div className="button-row ai-action-row">
              <button onClick={handleOpenChatGPT}>ChatGPT 새 창 열기</button>
            </div>
          </div>

          <div className="ai-tool-card">
            <p className="ai-tool-title">질문 템플릿</p>
            <div className="template-wrap">
              {QUESTION_TEMPLATES.map((template) => (
                <button key={template} className="template-btn" onClick={() => applyTemplate(template)}>
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-pane card ai-compose-pane">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">✨</span>Copilot 요청 작성</h3>
          <p className="muted">주제/유형을 정리하고 실행 버튼을 누르면 응답이 아래에 표시됩니다.</p>

          <div className="form-row multi ai-role-row">
            <select value={copilotRole} onChange={(e) => setCopilotRole(e.target.value)} disabled={copilotLoading}>
              {copilotRoles.length === 0 && <option value="general">general</option>}
              {copilotRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAskCopilot} disabled={copilotLoading}>
              {copilotLoading ? 'Copilot 처리 중...' : 'Copilot SDK 실행'}
            </button>
          </div>

          <div className="form-row">
            <input
              type="text"
              placeholder="주제 입력 (예: 운영체제 스케줄링)"
              value={promptTopic}
              onChange={(e) => setPromptTopic(e.target.value)}
            />
          </div>

          <div className="form-row multi">
            <select value={promptTaskType} onChange={(e) => setPromptTaskType(e.target.value)}>
              <option value="개념 설명">개념 설명</option>
              <option value="문제 풀이">문제 풀이</option>
              <option value="코드 리뷰">코드 리뷰</option>
              <option value="요약 정리">요약 정리</option>
            </select>

            <select value={promptLevel} onChange={(e) => setPromptLevel(e.target.value)}>
              <option value="초급">초급</option>
              <option value="중급">중급</option>
              <option value="고급">고급</option>
            </select>

            <select value={promptFormat} onChange={(e) => setPromptFormat(e.target.value)}>
              <option value="체크리스트">체크리스트</option>
              <option value="단계별">단계별</option>
              <option value="표 형식">표 형식</option>
              <option value="짧은 요약">짧은 요약</option>
            </select>
          </div>

          <div className="button-row ai-action-row">
            <button onClick={handleGeneratePromptTemplate}>템플릿 생성</button>
            <button type="button" className="btn-control btn-reset" onClick={handleResetPromptTemplate}>초기화</button>
          </div>

          <textarea
            className="ai-editor"
            rows={9}
            placeholder="생성된 프롬프트 템플릿이 여기에 표시됩니다"
            value={questionNote}
            onChange={(e) => setQuestionNote(e.target.value)}
          />

          {copilotError && <p className="login-error">{copilotError}</p>}

          <div className="copilot-reply-wrap">
            <h4 className="pane-title ai-response-head"><span className="pane-icon" aria-hidden="true">🧩</span>Copilot SDK 응답</h4>
            <pre className="copilot-reply">{copilotReply || '아직 응답이 없습니다. 질문 템플릿을 만들고 Copilot SDK 실행을 눌러보세요.'}</pre>
          </div>
        </div>
      </div>
    </section>
  );

  const renderSummary = () => (
    <section className="card section-screen">
      <div className="section-head">
        <h2>Study Quiz Generator 화면</h2>
        <button onClick={goHome}>뒤로가기</button>
      </div>

      <div className="section-split">
        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">📥</span>자료 입력</h3>
          <p>공부 파일(.txt/.md/.csv/.json) 또는 텍스트 자료를 넣고 퀴즈를 생성하세요.</p>

          <div className="form-row">
            <input type="file" accept=".txt,.md,.csv,.json" onChange={handleQuizFileUpload} />
          </div>

          {quizFileName && <p className="muted">불러온 파일: {quizFileName}</p>}

          <textarea
            rows={12}
            placeholder="여기에 공부 자료를 붙여넣으세요. 예: 개념 설명, 요약 노트, 강의 정리"
            value={quizMaterial}
            onChange={(event) => setQuizMaterial(event.target.value)}
          />

          <div className="quiz-controls">
            <div className="form-row">
              <label htmlFor="quiz-difficulty">난이도</label>
              <select
                id="quiz-difficulty"
                value={quizDifficulty}
                onChange={(event) => setQuizDifficulty(event.target.value)}
              >
                <option value="하">하</option>
                <option value="중">중</option>
                <option value="상">상</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="quiz-type">퀴즈 유형</label>
              <select
                id="quiz-type"
                value={quizType}
                onChange={(event) => setQuizType(event.target.value)}
              >
                <option value="자동">자동 (난이도 기반)</option>
                <option value="객관식">객관식</option>
                <option value="빈칸">빈칸</option>
                <option value="서술형">서술형</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="quiz-count">문제 수 (1~15)</label>
              <input
                id="quiz-count"
                type="number"
                min={1}
                max={15}
                step={1}
                value={quizCount}
                onChange={(event) => setQuizCount(event.target.value)}
                placeholder="예: 7"
              />
            </div>
          </div>

          <div className="button-row quiz-actions">
            <button onClick={handleGenerateQuiz}>퀴즈 생성</button>
            <button className="btn-control btn-reset" onClick={handleResetQuiz}>초기화</button>
          </div>

          {quizError && <p className="quiz-error">{quizError}</p>}
        </div>

        <div className="section-pane card">
          <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🧠</span>생성된 퀴즈</h3>

          {!quizQuestions.length && (
            <div className="quiz-empty card">
              <p>아직 생성된 문제가 없습니다.</p>
              <p className="muted">좌측에서 자료를 넣고 난이도/문제 수를 선택한 뒤 퀴즈를 생성해보세요.</p>
            </div>
          )}

          {!!quizQuestions.length && (
            <ol className="quiz-list">
              {quizQuestions.map((item, index) => (
                <li key={item.id} className="quiz-item">
                  <p className="quiz-type">문제 {index + 1} · {item.type}</p>
                  <p className="quiz-question">{item.question}</p>

                  {!!item.choices.length && (
                    <ul className="quiz-choice-list">
                      {item.choices.map((choice) => (
                        <li key={`${item.id}-${choice}`}>{choice}</li>
                      ))}
                    </ul>
                  )}

                  <p className="quiz-answer">정답/해설: {item.answer}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );

  const renderResources = () => {
    const handleGetRecommendations = () => {
      setOpportunityRecommendations(opportunityRecommendations.length > 0 ? [] : recommendations);
    };

    return (
      <section className="card section-screen">
        <div className="section-head">
          <h2>공모전 & 대외활동 추천</h2>
          <button onClick={goHome}>뒤로가기</button>
        </div>

        <div className="section-split">
          <div className="section-pane card">
            <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🎯</span>추천 받기</h3>
            <p>당신의 학습 현황을 바탕으로 AI가 최적의 기회를 추천합니다.</p>

            <div className="form-row">
              <label htmlFor="opportunity-category">카테고리 선택</label>
              <select
                id="opportunity-category"
                value={opportunityCategory}
                onChange={(event) => setOpportunityCategory(event.target.value)}
              >
                <option value="공모전">공모전</option>
                <option value="인턴십">인턴십</option>
              </select>
            </div>

            <div className="summary-metric-grid">
              <article className="summary-metric">
                <p className="summary-metric-label">뽀모도로 완료</p>
                <p className="summary-metric-value">{completedPomodoros}<span>회</span></p>
              </article>

              <article className="summary-metric">
                <p className="summary-metric-label">집중 시간</p>
                <p className="summary-metric-value">{totalFocusMinutes}<span>분</span></p>
              </article>

              <article className="summary-metric">
                <p className="summary-metric-label">할 일 완료율</p>
                <p className="summary-metric-value">{totalTodoCount > 0 ? Math.round((completedTodoCount / totalTodoCount) * 100) : 0}<span>%</span></p>
              </article>

              <article className="summary-metric">
                <p className="summary-metric-label">오늘 커밋</p>
                <p className="summary-metric-value">{todayCommitCount}<span>개</span></p>
              </article>
            </div>

            <div className="button-row quiz-actions">
              <button onClick={handleGetRecommendations}>AI 추천받기</button>
            </div>
          </div>

          <div className="section-pane card">
            <h3 className="pane-title"><span className="pane-icon" aria-hidden="true">🌟</span>추천 기회</h3>

            {!opportunityRecommendations.length && (
              <div className="quiz-empty card">
                <p>아직 추천을 받지 않았습니다.</p>
                <p className="muted">좌측에서 카테고리를 선택하고 "AI 추천받기"를 눌러보세요!</p>
              </div>
            )}

            {!!opportunityRecommendations.length && (
              <ul className="opportunity-list">
                {opportunityRecommendations.map((item, index) => (
                  <li key={index} className="opportunity-item">
                    <div className="opportunity-header">
                      <span className="opportunity-icon">{item.icon}</span>
                      <div className="opportunity-info">
                        <p className="opportunity-title">{item.title}</p>
                        <p className="opportunity-desc">{item.description}</p>
                      </div>
                    </div>
                    <div className="opportunity-meta">
                      <span className="opportunity-level">난이도: {item.difficulty}</span>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="opportunity-link">
                        바로가기 →
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="app">
      {selectedSection === SECTIONS.INTRO && renderIntro()}
      {selectedSection === SECTIONS.LOGIN && renderLogin()}
      {selectedSection === SECTIONS.HOME && renderHome()}
      {selectedSection === SECTIONS.STUDY && renderStudy()}
      {selectedSection === SECTIONS.NOTION && renderNotion()}
      {selectedSection === SECTIONS.GITHUB && renderGithub()}
      {selectedSection === SECTIONS.AI && renderAI()}
      {selectedSection === SECTIONS.SUMMARY && renderSummary()}
      {selectedSection === SECTIONS.RESOURCES && renderResources()}
    </div>
  );
}

export default App;

