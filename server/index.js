/* global process */

import cors from 'cors';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersPath = path.join(__dirname, 'users.json');
const studyDataPath = path.join(__dirname, 'study-data.json');
const auditLogPath = path.join(__dirname, 'audit.log');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const PORT = Number.parseInt(process.env.AUTH_PORT || '4000', 10);
const JWT_ACCESS_SECRET = process.env.AUTH_JWT_SECRET || 'uni-study-dev-access-secret';
const JWT_REFRESH_SECRET = process.env.AUTH_REFRESH_SECRET || 'uni-study-dev-refresh-secret';
const COPILOT_API_KEY = process.env.COPILOT_API_KEY || '';
const COPILOT_MODEL = process.env.COPILOT_MODEL || 'gpt-4o-mini';
const COPILOT_API_URL = process.env.COPILOT_API_URL || 'https://api.openai.com/v1/chat/completions';
const AUTH_MAX_FAILED_ATTEMPTS = Number.parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS || '5', 10);
const AUTH_LOCK_MINUTES = Number.parseInt(process.env.AUTH_LOCK_MINUTES || '15', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const COPILOT_ROLE_PRESETS = {
  general: {
    name: 'General Assistant',
    description: '기본 문제 해결, 코드 설명, 구현 가이드',
    prompt:
      'You are a practical coding copilot for a student dashboard project. Give concise, correct, and implementation-ready guidance. Prioritize actionable steps and safe defaults.',
  },
  planner: {
    name: 'Feature Planner',
    description: '기능 설계와 구현 순서 제안',
    prompt:
      'You are a feature planning copilot. Break work into small, testable steps. Include API shape, state flow, and validation checks. Avoid overengineering.',
  },
  reviewer: {
    name: 'Code Reviewer',
    description: '버그/리스크 중심 리뷰',
    prompt:
      'You are a strict code reviewer. Focus on correctness, security, and regressions. Provide findings first with severity and concrete fixes.',
  },
  backend: {
    name: 'Backend Engineer',
    description: 'Express API, auth, sync, 데이터 모델링',
    prompt:
      'You are a backend engineer for an Express app. Design robust endpoints, validate inputs, and propose minimal schema changes with migration-safe practices.',
  },
};

const signupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  username: z.string().trim().min(3).max(40),
  password: z.string().trim().min(8).max(128),
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().trim().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(20),
});

const copilotChatSchema = z.object({
  roleId: z.string().trim().optional(),
  message: z.string().trim().min(1).max(5000),
  context: z.string().trim().max(3000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(5000),
      })
    )
    .max(20)
    .optional(),
});

const studySyncSchema = z.object({
  todos: z.array(z.any()).max(1000).optional(),
  pomodoro: z
    .object({
      mode: z.enum(['focus', 'break']).optional(),
      secondsLeft: z.number().int().min(0).max(7200).optional(),
      completedPomodoros: z.number().int().min(0).max(100000).optional(),
      totalFocusMinutes: z.number().int().min(0).max(1000000).optional(),
    })
    .optional(),
  commitLogs: z.array(z.any()).max(5000).optional(),
  notionPlan: z.string().max(100000).optional(),
  notionTasks: z.array(z.any()).max(2000).optional(),
  questionNote: z.string().max(100000).optional(),
});

function assertProductionSecurity() {
  if (!IS_PROD) return;

  if (JWT_ACCESS_SECRET === 'uni-study-dev-access-secret') {
    throw new Error('AUTH_JWT_SECRET must be set in production.');
  }

  if (JWT_REFRESH_SECRET === 'uni-study-dev-refresh-secret') {
    throw new Error('AUTH_REFRESH_SECRET must be set in production.');
  }

  if (!COPILOT_API_KEY) {
    throw new Error('COPILOT_API_KEY must be set in production.');
  }
}

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (parsed.success) return parsed.data;

  const issue = parsed.error.issues[0];
  res.status(400).json({ message: `Invalid request: ${issue?.message || 'bad payload'}` });
  return null;
}

function getClientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) return xff.split(',')[0].trim();
  return req.ip || 'unknown';
}

async function appendAuditLog(event, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };

  try {
    await fs.appendFile(auditLogPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch {
    // ignore audit write failure to avoid breaking API flow
  }
}

assertProductionSecurity();
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('CORS blocked for this origin.'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth requests. Please try again later.' },
});

const copilotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many copilot requests. Please slow down.' },
});

async function readUsers() {
  try {
    const raw = await fs.readFile(usersPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await fs.writeFile(usersPath, JSON.stringify({ users }, null, 2), 'utf-8');
}

async function readStudyData() {
  try {
    const raw = await fs.readFile(studyDataPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStudyData(data) {
  await fs.writeFile(studyDataPath, JSON.stringify(data, null, 2), 'utf-8');
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      name: user.name,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

async function issueTokensForUser(userId) {
  const users = await readUsers();
  const user = users.find((item) => item.id === userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const currentTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  user.refreshTokens = [refreshToken, ...currentTokens].slice(0, 5);
  await writeUsers(users);

  return {
    token: accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

function authRequired(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authorization token is required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      username: payload.username,
      name: payload.name,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token.' });
  }
}

function buildCopilotMessages({ roleId, message, context, history }) {
  const rolePreset = COPILOT_ROLE_PRESETS[roleId] || COPILOT_ROLE_PRESETS.general;
  const normalizedHistory = Array.isArray(history)
    ? history
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
        .slice(-8)
    : [];

  return [
    {
      role: 'system',
      content: rolePreset.prompt,
    },
    {
      role: 'system',
      content: `Project context: ${String(context || 'No additional context provided.')}`,
    },
    ...normalizedHistory,
    {
      role: 'user',
      content: message,
    },
  ];
}

function fallbackCopilotReply({ roleId, message }) {
  const rolePreset = COPILOT_ROLE_PRESETS[roleId] || COPILOT_ROLE_PRESETS.general;
  return [
    `[${rolePreset.name}]`,
    'COPILOT_API_KEY가 없어 로컬 fallback 응답을 반환합니다.',
    '다음 구조로 진행하면 됩니다:',
    `1) 요구사항 요약: ${message.slice(0, 120)}`,
    '2) 입력/출력 계약 정의',
    '3) 최소 구현 -> 테스트 -> 확장 순서로 진행',
  ].join('\n');
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Auth API is running.' });
});

app.get('/api/ready', (_req, res) => {
  if (IS_PROD && !COPILOT_API_KEY) {
    return res.status(503).json({ ok: false, message: 'Copilot provider key missing.' });
  }

  return res.json({ ok: true, env: NODE_ENV, copilotConfigured: Boolean(COPILOT_API_KEY) });
});

app.get('/api/copilot/roles', authRequired, (_req, res) => {
  const roles = Object.entries(COPILOT_ROLE_PRESETS).map(([id, role]) => ({
    id,
    name: role.name,
    description: role.description,
  }));

  return res.json({ roles });
});

app.post('/api/copilot/chat', authRequired, copilotLimiter, async (req, res) => {
  const payload = parseBody(copilotChatSchema, req, res);
  if (!payload) return;

  const roleId = String(payload.roleId || 'general');
  const message = payload.message.trim();
  const context = String(payload.context || '').trim();
  const history = payload.history;

  if (!COPILOT_API_KEY) {
    if (IS_PROD) {
      return res.status(503).json({ message: 'Copilot provider key is not configured.' });
    }

    return res.json({
      provider: 'fallback',
      roleId,
      reply: fallbackCopilotReply({ roleId, message }),
    });
  }

  const messages = buildCopilotMessages({ roleId, message, context, history });

  try {
    const response = await fetch(COPILOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${COPILOT_API_KEY}`,
      },
      body: JSON.stringify({
        model: COPILOT_MODEL,
        temperature: 0.2,
        messages,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({
        message: data?.error?.message || 'Copilot provider request failed.',
      });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(502).json({ message: 'Copilot provider returned empty response.' });
    }

    return res.json({
      provider: 'llm',
      roleId,
      reply,
    });
  } catch {
    await appendAuditLog('copilot_provider_error', {
      userId: req.user?.id,
      roleId,
      requestId: req.requestId,
    });
    return res.status(502).json({ message: 'Failed to reach copilot provider.' });
  }
});

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const payload = parseBody(signupSchema, req, res);
  if (!payload) return;

  const { name } = payload;
  const username = payload.username.trim();
  const password = payload.password;

  const normalizedUsername = username.toLowerCase();
  const users = await readUsers();
  const exists = users.some((user) => user.username.toLowerCase() === normalizedUsername);

  if (exists) {
    return res.status(409).json({ message: 'This username is already in use.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: `user_${Date.now()}`,
    name,
    username,
    passwordHash,
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);

  const auth = await issueTokensForUser(newUser.id);

  await appendAuditLog('auth_signup_success', {
    userId: newUser.id,
    username: newUser.username,
    requestId: req.requestId,
    ip: getClientIp(req),
  });

  return res.status(201).json({
    message: 'Account created successfully.',
    token: auth.token,
    refreshToken: auth.refreshToken,
    user: auth.user,
  });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const payload = parseBody(loginSchema, req, res);
  if (!payload) return;

  const username = payload.username.trim();
  const password = payload.password;

  const normalizedUsername = username.toLowerCase();
  const users = await readUsers();
  const user = users.find((item) => item.username.toLowerCase() === normalizedUsername);

  if (!user) {
    await appendAuditLog('auth_login_failed_unknown_user', {
      username,
      requestId: req.requestId,
      ip: getClientIp(req),
    });
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  if (user.lockUntil && Date.parse(user.lockUntil) > Date.now()) {
    await appendAuditLog('auth_login_blocked_locked', {
      userId: user.id,
      username: user.username,
      requestId: req.requestId,
      ip: getClientIp(req),
    });
    return res.status(423).json({ message: 'Account is temporarily locked. Please try again later.' });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    const attempts = Number.isInteger(user.failedLoginAttempts) ? user.failedLoginAttempts + 1 : 1;
    user.failedLoginAttempts = attempts;

    if (attempts >= AUTH_MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + AUTH_LOCK_MINUTES * 60 * 1000).toISOString();
      user.lockUntil = lockUntil;
      user.failedLoginAttempts = 0;
    }

    await writeUsers(users);
    await appendAuditLog('auth_login_failed_bad_password', {
      userId: user.id,
      username: user.username,
      requestId: req.requestId,
      ip: getClientIp(req),
    });
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await writeUsers(users);
  }

  const auth = await issueTokensForUser(user.id);

  await appendAuditLog('auth_login_success', {
    userId: user.id,
    username: user.username,
    requestId: req.requestId,
    ip: getClientIp(req),
  });

  return res.json({
    message: 'Login successful.',
    token: auth.token,
    refreshToken: auth.refreshToken,
    user: auth.user,
  });
});

app.post('/api/auth/refresh', authLimiter, async (req, res) => {
  const body = parseBody(refreshSchema, req, res);
  if (!body) return;
  const refreshToken = body.refreshToken.trim();

  let verifiedPayload;
  try {
    verifiedPayload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    await appendAuditLog('auth_refresh_failed_invalid_token', {
      requestId: req.requestId,
      ip: getClientIp(req),
    });
    return res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }

  const users = await readUsers();
  const user = users.find((item) => item.id === verifiedPayload.sub);
  if (!user) {
    return res.status(401).json({ message: 'Invalid refresh token user.' });
  }

  const currentTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  const hasToken = currentTokens.includes(refreshToken);
  if (!hasToken) {
    return res.status(401).json({ message: 'Refresh token has been revoked.' });
  }

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  user.refreshTokens = [newRefreshToken, ...currentTokens.filter((item) => item !== refreshToken)].slice(0, 5);
  await writeUsers(users);

  return res.json({
    message: 'Token refreshed successfully.',
    token: newAccessToken,
    refreshToken: newRefreshToken,
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/logout', authLimiter, async (req, res) => {
  const payload = parseBody(refreshSchema, req, res);
  if (!payload) return;
  const refreshToken = payload.refreshToken.trim();

  const users = await readUsers();
  let changed = false;

  users.forEach((user) => {
    const tokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
    const filtered = tokens.filter((item) => item !== refreshToken);
    if (filtered.length !== tokens.length) {
      user.refreshTokens = filtered;
      changed = true;
    }
  });

  if (changed) {
    await writeUsers(users);
  }

  await appendAuditLog('auth_logout', {
    requestId: req.requestId,
    ip: getClientIp(req),
  });

  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/study/sync', authRequired, async (req, res) => {
  const store = await readStudyData();
  const entry = store[req.user.id] || {
    todos: [],
    pomodoro: {
      mode: 'focus',
      secondsLeft: 1500,
      completedPomodoros: 0,
      totalFocusMinutes: 0,
    },
    commitLogs: [],
    notionPlan: '',
    notionTasks: [],
    questionNote: '',
  };

  return res.json(entry);
});

app.put('/api/study/sync', authRequired, async (req, res) => {
  const payload = parseBody(studySyncSchema, req, res);
  if (!payload) return;
  const store = await readStudyData();

  store[req.user.id] = {
    todos: Array.isArray(payload.todos) ? payload.todos : [],
    pomodoro: payload.pomodoro && typeof payload.pomodoro === 'object'
      ? {
          mode: payload.pomodoro.mode === 'break' ? 'break' : 'focus',
          secondsLeft: Number.isInteger(payload.pomodoro.secondsLeft) ? payload.pomodoro.secondsLeft : 1500,
          completedPomodoros: Number.isInteger(payload.pomodoro.completedPomodoros) ? payload.pomodoro.completedPomodoros : 0,
          totalFocusMinutes: Number.isInteger(payload.pomodoro.totalFocusMinutes) ? payload.pomodoro.totalFocusMinutes : 0,
        }
      : {
          mode: 'focus',
          secondsLeft: 1500,
          completedPomodoros: 0,
          totalFocusMinutes: 0,
        },
    commitLogs: Array.isArray(payload.commitLogs) ? payload.commitLogs : [],
    notionPlan: typeof payload.notionPlan === 'string' ? payload.notionPlan : '',
    notionTasks: Array.isArray(payload.notionTasks) ? payload.notionTasks : [],
    questionNote: typeof payload.questionNote === 'string' ? payload.questionNote : '',
    updatedAt: new Date().toISOString(),
  };

  await writeStudyData(store);
  return res.json({ message: 'Study data synced.' });
});

app.use((error, _req, res) => {
  const message = String(error?.message || 'Server error');

  if (message.includes('CORS blocked')) {
    return res.status(403).json({ message: 'CORS blocked for this origin.' });
  }

  return res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Auth API running on http://localhost:${PORT}`);
});
