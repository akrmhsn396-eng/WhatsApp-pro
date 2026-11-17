/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { store } from './store.ts';
import { authDb, sha256Hex, hashPassword, verifyPassword } from './authDb.ts';
import type { AuthSessionRow } from './authDb.ts';

const __authDirname = path.dirname(fileURLToPath(import.meta.url));
function getFirebaseWebApiKey(): string {
  try {
    const cfgPath = path.resolve(__authDirname, '..', 'firebase-applet-config.json');
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return parsed?.apiKey || '';
  } catch {
    return '';
  }
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_REQUESTS = 10;
const AUTH_SERVER_STARTED_AT = Date.now();

export interface AuthRouterHooks {
  onSessionRevoked: (sessionId: string) => void;
  onUserRegistered: (user: any) => void;
  onUserUpdated: (user: any) => void;
  onContactsMatched: (ownerId: string, newUserId: string) => void;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function parseDeviceLabel(userAgent?: string, providedName?: string): string {
  if (providedName && providedName.trim()) {
    return providedName.trim().slice(0, 60);
  }
  const ua = (userAgent || '').toLowerCase();
  let browser = 'متصفح الويب';
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('chrome/') || ua.includes('crios/')) browser = 'Google Chrome';
  else if (ua.includes('firefox/') || ua.includes('fxios/')) browser = 'Mozilla Firefox';
  else if (ua.includes('safari/')) browser = 'Safari';

  let os = 'جهاز ويب';
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  return `${browser} · ${os}`;
}

export function extractClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function extractBearerToken(req: express.Request): string {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function issueSessionForAccount(
  accountId: string,
  email: string,
  req: express.Request,
  customDevice?: string
): { row: AuthSessionRow; rawToken: string; rawRefreshToken: string } {
  const now = Date.now();
  const rawToken = generateToken();
  const rawRefreshToken = generateToken();
  const row = authDb.createSession({
    id: 'sess-' + now + '-' + crypto.randomBytes(4).toString('hex'),
    rawToken,
    rawRefreshToken,
    accountId,
    email,
    deviceName: parseDeviceLabel(req.headers['user-agent'], customDevice),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 140) : undefined,
    ipAddress: extractClientIp(req),
    expiresAt: now + SESSION_TTL_MS,
  });
  return { row, rawToken, rawRefreshToken };
}

function sanitizeSession(row: AuthSessionRow, currentSessionId?: string) {
  return {
    id: row.id,
    userId: row.account_id,
    email: row.email,
    deviceName: row.device_name,
    ipAddress: row.ip_address || undefined,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    expiresAt: row.expires_at,
    isCurrent: !!currentSessionId && row.id === currentSessionId,
  };
}

export function syncAuthDbWithStore() {
  authDb.bootstrapAccounts(store.getAllRawUsers());
}

export function validateSessionToken(token: string): { accountId: string; sessionId: string } | null {
  const row = authDb.getSessionByRawToken(token, true);
  if (!row) return null;
  return { accountId: row.account_id, sessionId: row.id };
}

export function createAuthRouter(hooks: AuthRouterHooks): express.Router {
  syncAuthDbWithStore();

  const router = express.Router();

  // Health Endpoint
  router.get('/health', (_req, res) => {
    const stats = authDb.getHealthStats();
    res.json({
      status: 'ok',
      service: 'whatsapp-email-auth-server',
      uptimeSeconds: Math.floor((Date.now() - AUTH_SERVER_STARTED_AT) / 1000),
      ...stats,
    });
  });

  // 1. Register with Email & Password
  router.post('/register', async (req, res) => {
    const { email, password, name, about, avatar, deviceName } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const ip = extractClientIp(req);
    const devLabel = parseDeviceLabel(req.headers['user-agent'], deviceName);

    if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 6) {
      return res.status(400).json({
        error: 'يرجى إدخال بريد إلكتروني صالح وكلمة مرور مكونة من 6 أحرف على الأقل.',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'الاسم الكامل مطلوب.' });
    }

    const existingAcc = authDb.findAccountByEmail(cleanEmail);
    if (existingAcc) {
      return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.' });
    }

    const userId = 'u-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const newUser = store.registerUser(
      name.trim(),
      cleanEmail,
      avatar || '',
      about || 'مرحباً! أستخدم WhatsApp Pro AI',
      true,
      cleanEmail,
      userId
    );

    const acc = authDb.upsertAccount({
      id: newUser.id,
      email: cleanEmail,
      password: String(password),
      displayName: name.trim(),
      about: about || 'مرحباً! أستخدم WhatsApp Pro AI',
      avatar: avatar || '',
    });

    authDb.markAccountLogin(acc.id);
    const issued = issueSessionForAccount(acc.id, cleanEmail, req, deviceName);

    authDb.logAudit({
      accountId: acc.id,
      email: cleanEmail,
      eventType: 'register_success',
      status: 'success',
      ipAddress: ip,
      deviceName: issued.row.device_name,
      details: 'إنشاء حساب جديد عبر البريد الإلكتروني',
    });

    const userObj = store.getUser(acc.id) || {
      id: acc.id,
      name: acc.display_name,
      email: acc.email,
      about: acc.about,
      avatar: acc.avatar,
      phoneVerified: true,
      hasTwoFactor: !!acc.two_factor_hash,
    };

    hooks.onUserRegistered(userObj);

    return res.json({
      status: 'authenticated',
      token: issued.rawToken,
      refreshToken: issued.rawRefreshToken,
      user: userObj,
      session: sanitizeSession(issued.row, issued.row.id),
    });
  });

  // 2. Login with Email & Password
  router.post('/login', async (req, res) => {
    const { email, password, deviceName } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const ip = extractClientIp(req);
    const devLabel = parseDeviceLabel(req.headers['user-agent'], deviceName);

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان.' });
    }

    const acc = authDb.findAccountByEmail(cleanEmail);
    if (!acc) {
      authDb.logAudit({
        email: cleanEmail,
        eventType: 'login_failure',
        status: 'failure',
        ipAddress: ip,
        deviceName: devLabel,
        details: 'حساب غير موجود',
      });
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    if (acc.locked_until && Date.now() < acc.locked_until) {
      const mins = Math.ceil((acc.locked_until - Date.now()) / 60000);
      return res.status(429).json({
        error: `تم قفل الحساب مؤقتاً بسبب محاولات دخول خاطئة. يرجى المحاولة بعد ${mins} دقائق.`,
      });
    }

    const isMatch = verifyPassword(String(password), acc.password_hash);
    if (!isMatch) {
      const failed = authDb.recordFailedLogin(acc.id);
      authDb.logAudit({
        accountId: acc.id,
        email: cleanEmail,
        eventType: 'login_failure',
        status: 'failure',
        ipAddress: ip,
        deviceName: devLabel,
        details: `كلمة مرور خاطئة (محاولة ${failed.attempts})`,
      });
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    authDb.markAccountLogin(acc.id);
    const issued = issueSessionForAccount(acc.id, cleanEmail, req, deviceName);

    authDb.logAudit({
      accountId: acc.id,
      email: cleanEmail,
      eventType: 'login_success',
      status: 'success',
      ipAddress: ip,
      deviceName: issued.row.device_name,
      details: 'تسجيل دخول ناجح عبر البريد الإلكتروني',
    });

    let userObj = store.getUser(acc.id);
    if (!userObj) {
      userObj = store.registerUser(acc.display_name, acc.email, acc.avatar, acc.about, true, acc.email, acc.id);
    }

    hooks.onUserUpdated(userObj);

    return res.json({
      status: 'authenticated',
      token: issued.rawToken,
      refreshToken: issued.rawRefreshToken,
      user: userObj,
      session: sanitizeSession(issued.row, issued.row.id),
    });
  });

  // 3. Google Sign-In Endpoint
  router.post('/google', (req, res) => {
    const { email, name, avatar, googleUid, deviceName } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const ip = extractClientIp(req);
    const devLabel = parseDeviceLabel(req.headers['user-agent'], deviceName);

    if (!cleanEmail) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب لتسجيل الدخول عبر جوجل' });
    }

    const existingAcc = authDb.findAccountByEmail(cleanEmail);
    let existingUser =
      (existingAcc && store.getUser(existingAcc.id)) ||
      store.findUserByEmail(cleanEmail) ||
      store.findUserByPhone(cleanEmail) ||
      store.registerUser(
        name || 'مستخدم جوجل',
        cleanEmail,
        avatar || '',
        'مسجل عبر Google Sign-In 🌐',
        true,
        cleanEmail,
        existingAcc?.id
      );
    const acc = authDb.upsertAccount({
      id: existingUser.id,
      email: cleanEmail,
      displayName: name || 'مستخدم جوجل',
      about: 'مسجل عبر Google Sign-In 🌐',
      avatar: avatar || '',
    });

    authDb.markAccountLogin(acc.id);
    const updatedUser = store.updateUserProfile(acc.id, { phoneVerified: true, lastSeen: 'الآن' }) || existingUser;
    const issued = issueSessionForAccount(acc.id, cleanEmail, req, deviceName);

    authDb.logAudit({
      accountId: acc.id,
      email: cleanEmail,
      eventType: 'login_success',
      status: 'success',
      ipAddress: ip,
      deviceName: issued.row.device_name,
      details: 'تسجيل دخول ناجح عبر Google Auth',
    });

    hooks.onUserUpdated({ ...updatedUser, hasTwoFactor: false });

    return res.json({
      status: 'authenticated',
      token: issued.rawToken,
      refreshToken: issued.rawRefreshToken,
      user: updatedUser,
      session: sanitizeSession(issued.row, issued.row.id),
    });
  });

  // 3b. Firebase Email/Password ID Token Sync Endpoint (used after password reset via sendPasswordResetEmail)
  router.post('/firebase-email', async (req, res) => {
    const { idToken, password, deviceName } = req.body || {};
    const ip = extractClientIp(req);
    const apiKey = getFirebaseWebApiKey();

    if (!idToken || !apiKey) {
      return res.status(400).json({ error: 'بيانات التحقق عبر Firebase غير مكتملة.' });
    }

    try {
      const verifyRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (!verifyRes.ok) {
        return res.status(401).json({ error: 'تعذر التحقق من جلسة Firebase Auth.' });
      }
      const verifyData: any = await verifyRes.json();
      const fbUser = verifyData?.users?.[0];
      const cleanEmail = String(fbUser?.email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(401).json({ error: 'لم يتم العثور على بريد إلكتروني موثق في الحساب.' });
      }

      const existingAcc = authDb.findAccountByEmail(cleanEmail);
      const displayName = fbUser?.displayName || existingAcc?.display_name || cleanEmail.split('@')[0];
      const avatar = fbUser?.photoUrl || existingAcc?.avatar || '';

      let userObj =
        (existingAcc && store.getUser(existingAcc.id)) ||
        store.findUserByEmail(cleanEmail) ||
        store.registerUser(
          displayName,
          cleanEmail,
          avatar,
          existingAcc?.about || 'مرحباً! أستخدم WhatsApp Pro AI',
          true,
          cleanEmail,
          existingAcc?.id
        );

      const acc = authDb.upsertAccount({
        id: userObj.id,
        email: cleanEmail,
        password: typeof password === 'string' && password.length >= 6 ? password : undefined,
        displayName,
        about: existingAcc?.about || 'مرحباً! أستخدم WhatsApp Pro AI',
        avatar,
      });

      if (typeof password === 'string' && password.length >= 6) {
        authDb.updateAccountPassword(acc.id, password);
      }

      authDb.markAccountLogin(acc.id);
      const issued = issueSessionForAccount(acc.id, cleanEmail, req, deviceName);

      authDb.logAudit({
        accountId: acc.id,
        email: cleanEmail,
        eventType: 'firebase_email_login',
        status: 'success',
        ipAddress: ip,
        deviceName: issued.row.device_name,
        details: 'تسجيل دخول عبر البريد الإلكتروني بعد التحقق من Firebase',
      });

      hooks.onUserUpdated(userObj);

      return res.json({
        status: 'authenticated',
        token: issued.rawToken,
        refreshToken: issued.rawRefreshToken,
        user: userObj,
        session: sanitizeSession(issued.row, issued.row.id),
      });
    } catch (err: any) {
      return res.status(502).json({ error: err?.message || 'خطأ أثناء التحقق من Firebase Auth' });
    }
  });

  // 3c. Audit Log for Firebase Password Reset Request
  router.post('/password-reset-log', (req, res) => {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح.' });
    }
    const acc = authDb.findAccountByEmail(cleanEmail);
    authDb.logAudit({
      accountId: acc?.id || null,
      email: cleanEmail,
      eventType: 'password_reset_requested',
      status: 'success',
      ipAddress: extractClientIp(req),
      deviceName: parseDeviceLabel(req.headers['user-agent'], req.body?.deviceName),
      details: 'تم إرسال رابط إعادة تعيين كلمة المرور عبر Firebase sendPasswordResetEmail',
    });
    res.json({ ok: true });
  });

  // 4. Get Current Auth User & Session (/me)
  router.get('/me', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'رمز الجلسة مفقود' });
    }
    const sessionRow = authDb.getSessionByRawToken(token, true);
    if (!sessionRow) {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة أو غير صالحة' });
    }

    const user = store.getUser(sessionRow.account_id);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const sessions = authDb.getActiveSessionsForAccount(sessionRow.account_id);

    res.json({
      user,
      session: sanitizeSession(sessionRow, sessionRow.id),
      sessions: sessions.map(s => sanitizeSession(s, sessionRow.id)),
    });
  });

  // 5. Logout
  router.post('/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      const revoked = authDb.revokeSessionByRawToken(token);
      if (revoked) {
        hooks.onSessionRevoked(revoked.id);
      }
    }
    res.json({ ok: true });
  });

  // 6. List Active Sessions
  router.get('/sessions', (req, res) => {
    const token = extractBearerToken(req);
    const sessionRow = authDb.getSessionByRawToken(token, false);
    if (!sessionRow) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const sessions = authDb.getActiveSessionsForAccount(sessionRow.account_id);
    res.json({
      sessions: sessions.map(s => sanitizeSession(s, sessionRow.id)),
    });
  });

  // 7. Revoke Session
  router.post('/sessions/:id/revoke', (req, res) => {
    const token = extractBearerToken(req);
    const sessionRow = authDb.getSessionByRawToken(token, false);
    if (!sessionRow) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const targetSessionId = req.params.id;
    const revoked = authDb.revokeSessionById(targetSessionId, sessionRow.account_id);
    if (!revoked) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }
    hooks.onSessionRevoked(revoked.id);
    res.json({ ok: true });
  });

  return router;
}

export function syncAuthDbWithStoreOnStartup() {
  syncAuthDbWithStore();
}
