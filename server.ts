import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { store } from './server/store.ts';
import type { StoredMessage, StoredStatus } from './server/store.ts';
import { createAuthRouter, validateSessionToken, syncAuthDbWithStore } from './server/auth.ts';
import { authDb } from './server/authDb.ts';
import {
  DEFAULT_PUBLIC_PWA_URL,
  generateApkWithPwabuilder,
  getDigitalAssetLinksPayload,
  getStoredApkMeta,
  resolveArtifactDownload,
  runPwabuilderAnalysis,
} from './server/pwaBuilder.ts';
import {
  extractFirstUrlFromText,
  fetchLinkPreview,
  validatePublicHttpUrl,
} from './server/linkPreview.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.resolve(__dirname, 'data', 'media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '7d' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Connected WebSocket clients per userId and per SQLite auth sessionId
const userSockets = new Map<string, Set<WebSocket>>();
const sessionSockets = new Map<string, Set<WebSocket>>();

function getOnlineUserIds(): string[] {
  return Array.from(userSockets.entries())
    .filter(([, set]) => set.size > 0)
    .map(([id]) => id);
}

function sendToUser(userId: string, payload: unknown) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const serialized = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function broadcastAll(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
}

function broadcastToMembers(memberIds: string[], payload: unknown) {
  for (const uid of memberIds) {
    sendToUser(uid, payload);
  }
}

function isUserOnline(userId: string): boolean {
  const s = userSockets.get(userId);
  return !!s && s.size > 0;
}

function syncConversationToMembers(convId: string, memberIds: string[]) {
  for (const uid of memberIds) {
    const filtered = store.getConversationForUser(convId, uid);
    if (filtered) {
      sendToUser(uid, { type: 'conversation:sync', conversation: filtered });
    }
  }
}

function enrichMessageLinkPreview(convId: string, msg: StoredMessage, memberIds: string[]) {
  if (!msg || msg.isDeletedForAll || msg.skipLinkPreview || msg.linkPreview) return;
  if (msg.type && msg.type !== 'text') return;
  const detectedUrl = extractFirstUrlFromText(msg.text || '');
  if (!detectedUrl) return;

  fetchLinkPreview(detectedUrl)
    .then(preview => {
      if (!preview) return;
      const updated = store.attachLinkPreview(convId, msg.id, preview);
      if (!updated) return;
      if (updated.status === 'scheduled') {
        sendToUser(updated.senderId, {
          type: 'message:updated',
          conversationId: convId,
          message: updated,
        });
      } else {
        broadcastToMembers(memberIds, {
          type: 'message:updated',
          conversationId: convId,
          message: updated,
        });
      }
    })
    .catch(() => {});
}

const scheduledTimers = new Map<string, NodeJS.Timeout>();

function getScheduleKey(conversationId: string, messageId: string) {
  return `${conversationId}::${messageId}`;
}

function clearScheduledTimer(conversationId: string, messageId: string) {
  const key = getScheduleKey(conversationId, messageId);
  const existing = scheduledTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    scheduledTimers.delete(key);
  }
}

async function generateAiReply(
  userId: string,
  conversationId: string,
  message: string,
  history: StoredMessage[] = []
): Promise<string> {
  let replyText =
    'أهلاً بك! أنا Meta AI داخل واتساب. أعمل حالياً بالوضع المحلي السريع — يمكنك طرح الأسئلة أو تفعيل مفتاح Gemini API للحصول على قدرات الذكاء الاصطناعي الكاملة.';

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const formattedHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && typeof h.text === 'string' && h.text.trim() && h.status !== 'scheduled')
          .slice(-12)
          .map((h: any) => ({
            role: h.senderId === userId ? 'user' : 'model',
            parts: [{ text: h.text }],
          }))
      : [];

    const chat = ai.chats.create({
      model: 'gemini-3.8-flash',
      history: formattedHistory,
      config: {
        systemInstruction:
          'أنت مساعد Meta AI الذكي المدمج داخل تطبيق واتساب العربي الحديث. أجب باللغة العربية بأسلوب واضح، ودود، عملي، ومناسب لتطبيق المراسلة الفورية.',
      },
    });

    const response = await chat.sendMessage({ message });
    replyText = response.text || 'عذراً، لم أستطع تكوين رد في الوقت الحالي.';
  }

  if (userId && conversationId) {
    const aiMsg: StoredMessage = {
      id: 'ai-' + Date.now(),
      conversationId,
      senderId: 'meta-ai',
      senderName: 'Meta AI',
      text: replyText,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'read',
      type: 'text',
    };
    store.addMessage(conversationId, aiMsg);
    sendToUser(userId, { type: 'message:new', conversationId, message: aiMsg });
  }

  return replyText;
}

function triggerScheduledDispatch(conversationId: string, messageId: string) {
  clearScheduledTimer(conversationId, messageId);
  const conv = store.getConversation(conversationId);
  if (!conv) return;
  const msg = conv.messages.find(m => m.id === messageId);
  if (!msg || msg.status !== 'scheduled') return;

  const blockedByOther = (conv.blockedBy || []).some(id => id !== msg.senderId);
  if (blockedByOther) {
    store.removeScheduledMessage(conversationId, messageId, msg.senderId);
    sendToUser(msg.senderId, { type: 'message:removed', conversationId, messageId });
    sendToUser(msg.senderId, { type: 'toast', message: 'تعذر إرسال الرسالة المجدولة لهذا المستلم' });
    return;
  }

  const otherMembers = conv.memberIds.filter(id => id !== msg.senderId);
  const anyOnline = otherMembers.some(id => isUserOnline(id));
  const newStatus: 'sent' | 'delivered' | 'read' =
    conv.kind === 'ai' ? 'read' : anyOnline ? 'delivered' : 'sent';

  const result = store.dispatchScheduledMessage(conversationId, messageId, newStatus);
  if (!result) return;

  // Update sender's bubble from scheduled -> sent/delivered/read
  sendToUser(msg.senderId, {
    type: 'message:updated',
    conversationId,
    message: result.message,
  });

  // Deliver to recipient(s) for the first time at the scheduled time
  for (const memberId of otherMembers) {
    sendToUser(memberId, {
      type: 'message:new',
      conversationId,
      message: result.message,
    });
  }

  // Trigger Meta AI reply if scheduled for Meta AI
  if (conv.kind === 'ai' && result.message.text) {
    generateAiReply(msg.senderId, conversationId, result.message.text, conv.messages.slice(-10)).catch(err =>
      console.error('Scheduled AI reply error:', err)
    );
  }
}

function armScheduledTimer(conversationId: string, message: StoredMessage) {
  clearScheduledTimer(conversationId, message.id);
  if (message.status !== 'scheduled' || typeof message.scheduledAt !== 'number') return;

  const delay = message.scheduledAt - Date.now();
  if (delay <= 0) {
    triggerScheduledDispatch(conversationId, message.id);
    return;
  }

  const timeoutMs = Math.min(delay, 2147483647);
  const key = getScheduleKey(conversationId, message.id);
  const timer = setTimeout(() => {
    scheduledTimers.delete(key);
    if (Date.now() >= (message.scheduledAt || 0)) {
      triggerScheduledDispatch(conversationId, message.id);
    } else {
      armScheduledTimer(conversationId, message);
    }
  }, timeoutMs);
  scheduledTimers.set(key, timer);
}

function getEnrichedUsers() {
  return store.getUsers().map(u => {
    const acc = authDb.findAccountById(u.id);
    return {
      ...u,
      email: acc?.email || u.email || (u.phone?.includes('@') ? u.phone : undefined),
    };
  });
}

// REST Endpoints for accounts & AI
app.get('/api/users', (_req, res) => {
  res.json({ users: getEnrichedUsers(), onlineUserIds: getOnlineUserIds() });
});

app.get('/api/users/search', (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query) {
    return res.json({ users: [] });
  }

  const allUsers = getEnrichedUsers();
  const matched = allUsers.filter(u => {
    const nameMatch = u.name.toLowerCase().includes(query);
    const emailMatch = u.email ? u.email.toLowerCase().includes(query) : false;
    const phoneMatch = u.phone ? u.phone.toLowerCase().includes(query) : false;
    return nameMatch || emailMatch || phoneMatch;
  });

  // Query authDb accounts so even accounts not yet mirrored in store are discoverable
  const dbAccounts = authDb.searchAccounts(query);
  for (const acc of dbAccounts) {
    if (!matched.some(m => m.id === acc.id || (m.email && m.email.toLowerCase() === acc.email.toLowerCase()))) {
      matched.push({
        id: acc.id,
        name: acc.display_name,
        email: acc.email,
        phone: acc.email,
        about: acc.about || 'مستخدم مسجل',
        avatar: acc.avatar || '',
        lastSeen: 'مؤخراً',
      });
    }
  }

  res.json({ users: matched });
});

app.post('/api/users/register', (req, res) => {
  const { name, phone, email, avatar, creatorUserId } = req.body;
  const rawContact = (phone || email || '').trim();
  const isEmailInput = rawContact.includes('@') || (!!email && String(email).includes('@'));
  const cleanEmail = (email || (rawContact.includes('@') ? rawContact : '')).trim().toLowerCase();

  if (!name || !rawContact) {
    return res.status(400).json({ error: 'الاسم وبيانات التواصل مطلوبة' });
  }

  // If searching/starting chat with an email, resolve existing authDb account first so we connect to the real user
  const existingAuthAcc = cleanEmail ? authDb.findAccountByEmail(cleanEmail) : undefined;
  const user = existingAuthAcc
    ? store.getUser(existingAuthAcc.id) ||
      store.registerUser(
        existingAuthAcc.display_name || name,
        existingAuthAcc.email,
        existingAuthAcc.avatar || avatar,
        existingAuthAcc.about,
        true,
        existingAuthAcc.email,
        existingAuthAcc.id
      )
    : store.registerUser(name, rawContact, avatar, undefined, false, isEmailInput ? cleanEmail : undefined);

  syncAuthDbWithStore();
  const enrichedUser = {
    ...user,
    email: user.email || existingAuthAcc?.email || (isEmailInput ? cleanEmail : undefined),
  };
  broadcastAll({ type: 'user:registered', user: enrichedUser });

  let conversation = null;
  if (creatorUserId && creatorUserId !== enrichedUser.id) {
    const conv = store.ensureDmConversation(creatorUserId, enrichedUser.id);
    syncConversationToMembers(conv.id, conv.memberIds);
    conversation = store.getConversationForUser(conv.id, creatorUserId);
    if (!enrichedUser.phone.includes('@')) {
      store.syncContactsForUser(creatorUserId, [
        { displayName: enrichedUser.name, phone: enrichedUser.phone, email: enrichedUser.email, source: 'manual' },
      ]);
      sendToUser(creatorUserId, {
        type: 'contacts:synced',
        contacts: store.getSyncedContactsForUser(creatorUserId),
        lastSyncAt: store.getLastContactSyncAt(creatorUserId),
      });
    }
  }

  // Notify any connected users whose synced contacts now match this newly registered phone
  if (!enrichedUser.phone.includes('@')) {
    const affectedOwners = store.getAffectedUsersForPhone(enrichedUser.phone);
    for (const ownerId of affectedOwners) {
      if (ownerId === enrichedUser.id || (creatorUserId && ownerId === creatorUserId)) continue;
      const conv = store.ensureDmConversation(ownerId, enrichedUser.id);
      syncConversationToMembers(conv.id, conv.memberIds);
      sendToUser(ownerId, {
        type: 'contacts:synced',
        contacts: store.getSyncedContactsForUser(ownerId),
        lastSyncAt: store.getLastContactSyncAt(ownerId),
      });
    }
  }

  res.json({ user: enrichedUser, conversation });
});

app.get('/api/contacts/:userId', (req, res) => {
  const { userId } = req.params;
  if (!store.getUser(userId)) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }
  res.json({
    contacts: store.getSyncedContactsForUser(userId),
    lastSyncAt: store.getLastContactSyncAt(userId),
  });
});

app.post('/api/contacts/sync', (req, res) => {
  const { userId, contacts } = req.body;
  if (!userId || !store.getUser(userId)) {
    return res.status(400).json({ error: 'معرف المستخدم غير صالح' });
  }
  const result = Array.isArray(contacts) && contacts.length > 0
    ? store.syncContactsForUser(userId, contacts)
    : { ...store.resyncContactsForUser(userId), addedCount: 0, updatedCount: 0 };

  for (const c of result.contacts) {
    if (c.registeredUserId) {
      const conv = store.ensureDmConversation(userId, c.registeredUserId);
      syncConversationToMembers(conv.id, conv.memberIds);
    }
  }

  sendToUser(userId, {
    type: 'contacts:synced',
    contacts: result.contacts,
    lastSyncAt: result.lastSyncAt,
    summary: {
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      matchedCount: result.matchedCount,
    },
  });

  res.json(result);
});

app.delete('/api/contacts/:userId/:contactId', (req, res) => {
  const { userId, contactId } = req.params;
  if (!store.getUser(userId)) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }
  const contacts = store.deleteSyncedContact(userId, contactId);
  const lastSyncAt = store.getLastContactSyncAt(userId);
  sendToUser(userId, { type: 'contacts:synced', contacts, lastSyncAt });
  res.json({ contacts, lastSyncAt });
});

app.post('/api/users/profile', (req, res) => {
  const { userId, name, about, avatar } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const updated = store.updateUserProfile(userId, { name, about, avatar });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  syncAuthDbWithStore();
  broadcastAll({ type: 'user:updated', user: updated });
  res.json({ user: updated });
});

app.post(
  '/api/media/upload',
  express.raw({
    type: ['video/*', 'image/*', 'audio/*', 'application/octet-stream'],
    limit: '85mb',
  }),
  (req, res) => {
    try {
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        return res.status(400).json({ error: 'لم يتم استلام أي ملف وسائط' });
      }
      if (buf.length > 80 * 1024 * 1024) {
        return res.status(413).json({ error: 'حجم الملف يتجاوز الحد المسموح (80 ميجابايت)' });
      }
      const contentType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
      const rawName = String(req.headers['x-file-name'] || '').trim();
      const mimeToExt: Record<string, string> = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'video/ogg': '.ogv',
        'video/3gpp': '.3gp',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'audio/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/mp4': '.m4a',
      };
      const extFromName = path.extname(rawName).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const ext = mimeToExt[contentType] || (extFromName && extFromName.length <= 6 ? extFromName : '.bin');
      const fileName = `st-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      const targetPath = path.join(MEDIA_DIR, fileName);
      fs.writeFileSync(targetPath, buf);
      return res.json({
        url: `/media/${fileName}`,
        mimeType: contentType,
        size: buf.length,
      });
    } catch (err: any) {
      console.error('Media upload error:', err);
      return res.status(500).json({ error: 'فشل حفظ ملف الوسائط على الخادم' });
    }
  }
);

app.get('/api/version', (_req, res) => {
  res.json({ version: '2.2.0', releaseDate: '2026-11-17', name: 'WhatsApp Pro AI' });
});

app.get('/api/link-preview', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    const parsed = validatePublicHttpUrl(rawUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'رابط غير صالح للمعاينة' });
    }
    const preview = await fetchLinkPreview(parsed.toString());
    if (!preview) {
      return res.status(400).json({ error: 'تعذر جلب معاينة الرابط' });
    }
    return res.json({ preview });
  } catch {
    return res.status(500).json({ error: 'تعذر جلب معاينة الرابط' });
  }
});

app.post('/api/reset', (_req, res) => {
  for (const timer of scheduledTimers.values()) {
    clearTimeout(timer);
  }
  scheduledTimers.clear();
  store.reset();
  syncAuthDbWithStore();
  broadcastAll({ type: 'store:reset' });
  res.json({ ok: true });
});

app.use(
  '/api/auth',
  createAuthRouter({
    onSessionRevoked: sessionId => {
      const sockets = sessionSockets.get(sessionId);
      if (!sockets) return;
      for (const sock of sockets) {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'auth:revoked' }));
        }
        sock.close(4001, 'Session revoked');
      }
      sessionSockets.delete(sessionId);
    },
    onUserRegistered: user => {
      broadcastAll({ type: 'user:registered', user });
    },
    onUserUpdated: user => {
      broadcastAll({ type: 'user:updated', user });
    },
    onContactsMatched: (ownerId, newUserId) => {
      const conv = store.ensureDmConversation(ownerId, newUserId);
      syncConversationToMembers(conv.id, conv.memberIds);
      sendToUser(ownerId, {
        type: 'contacts:synced',
        contacts: store.getSyncedContactsForUser(ownerId),
        lastSyncAt: store.getLastContactSyncAt(ownerId),
      });
    },
  })
);

// Multi-turn Meta AI Chat endpoint (also stores reply in server DB and pushes over WS)
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { userId, conversationId, message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const replyText = await generateAiReply(userId, conversationId, message, history);
    res.json({ reply: replyText });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Smart Reply Suggestions endpoint
app.post('/api/smart-replies', async (req, res) => {
  try {
    const { lastMessage } = req.body;
    if (!lastMessage) {
      return res.json({ suggestions: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        suggestions: ['تمام، يعطيك العافية 👍', 'حسناً سأتأكد الآن', 'ممتاز جداً!'],
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `اقترح 3 ردود عربية قصيرة وطبيعية ومناسبة لتطبيق واتساب رداً على هذه الرسالة: "${lastMessage}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim());
    res.json({ suggestions: Array.isArray(parsed) ? parsed.slice(0, 3) : [] });
  } catch {
    res.json({ suggestions: ['تمام 👍', 'شكراً لك', 'سأرد عليك قريباً'] });
  }
});

// Digital Asset Links for Trusted Web Activity (TWA) APK verification
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(getDigitalAssetLinksPayload());
});

// PWABuilder APK packaging status, audit, build, and artifact downloads
app.get('/api/pwa/apk-status', (_req, res) => {
  const meta = getStoredApkMeta();
  res.json({
    defaultTargetUrl: DEFAULT_PUBLIC_PWA_URL,
    hasBuiltApk: !!(meta && meta.files?.apk),
    build: meta,
  });
});

app.post('/api/pwa/analyze', async (req, res) => {
  try {
    const reqOrigin = `${req.protocol}://${req.get('host') || ''}`;
    const targetUrl = req.body?.targetUrl || reqOrigin;
    const summary = await runPwabuilderAnalysis(targetUrl);
    res.json(summary);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'تعذر إجراء فحص PWABuilder' });
  }
});

app.post('/api/pwa/generate-apk', async (req, res) => {
  try {
    const reqOrigin = `${req.protocol}://${req.get('host') || ''}`;
    const build = await generateApkWithPwabuilder(req.body || {}, reqOrigin);
    res.json({ success: true, build });
  } catch (err: any) {
    console.error('PWABuilder APK generation failed:', err);
    res.status(502).json({ error: err?.message || 'فشل توليد حزمة APK عبر PWABuilder' });
  }
});

app.get('/api/pwa/download/:artifact', (req, res) => {
  const resolved = resolveArtifactDownload(req.params.artifact);
  if (!resolved) {
    return res.status(404).json({ error: 'الملف غير متوفر بعد — قم بتوليد الحزمة أولاً' });
  }
  res.setHeader('Content-Type', resolved.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${resolved.downloadName}"`);
  res.sendFile(resolved.filePath);
});

async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const authToken = url.searchParams.get('token') || '';
    let userId = '';
    let sessionId = '';

    if (authToken) {
      const session = validateSessionToken(authToken);
      if (!session) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'auth:revoked' }));
        }
        ws.close(4001, 'Invalid or expired session token');
        return;
      }
      userId = session.accountId;
      sessionId = session.sessionId;
      if (!sessionSockets.has(sessionId)) {
        sessionSockets.set(sessionId, new Set());
      }
      sessionSockets.get(sessionId)!.add(ws);
    } else {
      userId = url.searchParams.get('userId') || '';
    }

    if (!userId || !store.getUser(userId)) {
      ws.close(1008, 'Unknown user');
      return;
    }

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(ws);

    // Mark pending messages for this user as delivered
    const deliveredConvIds = store.markDeliveredForUser(userId);
    for (const convId of deliveredConvIds) {
      const conv = store.getConversation(convId);
      if (conv) {
        syncConversationToMembers(convId, conv.memberIds);
      }
    }

    // Send initial authoritative sync to connecting client
    ws.send(
      JSON.stringify({
        type: 'init:sync',
        userId,
        users: getEnrichedUsers(),
        onlineUserIds: getOnlineUserIds(),
        conversations: store.getConversationsForUser(userId),
        statuses: store.getStatusesForUser(userId),
        calls: store.getCallsForUser(userId),
        channels: store.getChannels(),
        communities: store.getCommunities(),
        syncedContacts: store.getSyncedContactsForUser(userId),
        lastContactSyncAt: store.getLastContactSyncAt(userId),
      })
    );

    // Notify everyone about updated presence
    broadcastAll({
      type: 'presence:update',
      onlineUserIds: getOnlineUserIds(),
    });

    ws.on('message', raw => {
      try {
        const event = JSON.parse(raw.toString());

        switch (event.type) {
          case 'sync:request': {
            ws.send(
              JSON.stringify({
                type: 'init:sync',
                userId,
                users: getEnrichedUsers(),
                onlineUserIds: getOnlineUserIds(),
                conversations: store.getConversationsForUser(userId),
                statuses: store.getStatusesForUser(userId),
                calls: store.getCallsForUser(userId),
                channels: store.getChannels(),
                communities: store.getCommunities(),
                syncedContacts: store.getSyncedContactsForUser(userId),
                lastContactSyncAt: store.getLastContactSyncAt(userId),
              })
            );
            break;
          }

          case 'message:send': {
            const { conversationId, message } = event as {
              conversationId: string;
              message: StoredMessage;
            };
            const conv = store.getConversation(conversationId);
            if (!conv || !conv.memberIds.includes(userId)) break;

            // Check if any other participant blocked the sender
            const blockedByOther = (conv.blockedBy || []).some(id => id !== userId);
            if (blockedByOther) {
              sendToUser(userId, { type: 'toast', message: 'تعذر إرسال الرسالة لهذا المستلم' });
              break;
            }

            const scheduledAtNum =
              typeof message.scheduledAt === 'number' && Number.isFinite(message.scheduledAt)
                ? message.scheduledAt
                : undefined;
            const isFutureScheduled = !!scheduledAtNum && scheduledAtNum > Date.now();

            const otherMembers = conv.memberIds.filter(id => id !== userId);
            const anyOnline = otherMembers.some(id => isUserOnline(id));

            const storedMsg: StoredMessage = {
              ...message,
              conversationId,
              senderId: userId,
              senderName: store.getUser(userId)?.name,
              createdAt: message.createdAt || Date.now(),
              scheduledAt: scheduledAtNum,
              status: isFutureScheduled
                ? 'scheduled'
                : conv.kind === 'ai'
                ? 'read'
                : anyOnline
                ? 'delivered'
                : 'sent',
            };

            const saved = store.addMessage(conversationId, storedMsg);
            if (saved) {
              if (saved.status === 'scheduled') {
                // Only show the scheduled message to the sender until scheduledAt arrives
                sendToUser(userId, {
                  type: 'message:new',
                  conversationId,
                  message: saved,
                });
                armScheduledTimer(conversationId, saved);
              } else {
                broadcastToMembers(conv.memberIds, {
                  type: 'message:new',
                  conversationId,
                  message: saved,
                });
              }
              enrichMessageLinkPreview(conversationId, saved, conv.memberIds);
            }
            break;
          }

          case 'message:send_now': {
            const { conversationId, messageId } = event;
            const conv = store.getConversation(conversationId);
            const msg = conv?.messages.find(m => m.id === messageId);
            if (conv && msg && msg.senderId === userId && msg.status === 'scheduled') {
              triggerScheduledDispatch(conversationId, messageId);
            }
            break;
          }

          case 'message:cancel_schedule': {
            const { conversationId, messageId } = event;
            clearScheduledTimer(conversationId, messageId);
            if (store.removeScheduledMessage(conversationId, messageId, userId)) {
              sendToUser(userId, {
                type: 'message:removed',
                conversationId,
                messageId,
              });
            }
            break;
          }

          case 'chat:read': {
            const { conversationId, sendReadReceipt } = event;
            const conv = store.getConversation(conversationId);
            if (!conv || !conv.memberIds.includes(userId)) break;
            const { changed, statusUpdated } = store.markConversationRead(
              conversationId,
              userId,
              sendReadReceipt !== false
            );
            if (statusUpdated) {
              broadcastToMembers(conv.memberIds, {
                type: 'conversation:read',
                conversationId,
                readerId: userId,
              });
            } else if (changed) {
              syncConversationToMembers(conversationId, [userId]);
            }
            break;
          }

          case 'typing:start':
          case 'typing:stop': {
            const { conversationId } = event;
            const conv = store.getConversation(conversationId);
            if (!conv || !conv.memberIds.includes(userId)) break;
            for (const memberId of conv.memberIds) {
              if (memberId !== userId) {
                sendToUser(memberId, {
                  type: 'typing:update',
                  conversationId,
                  userId,
                  isTyping: event.type === 'typing:start',
                });
              }
            }
            break;
          }

          case 'message:edit': {
            const { conversationId, messageId, newText, linkPreview, skipLinkPreview } = event;
            const conv = store.getConversation(conversationId);
            const updated = store.editMessage(conversationId, messageId, userId, newText, linkPreview);
            if (conv && updated) {
              updated.skipLinkPreview = !!skipLinkPreview;
              if (updated.status === 'scheduled') {
                sendToUser(userId, { type: 'message:updated', conversationId, message: updated });
              } else {
                broadcastToMembers(conv.memberIds, {
                  type: 'message:updated',
                  conversationId,
                  message: updated,
                });
              }
              enrichMessageLinkPreview(conversationId, updated, conv.memberIds);
            }
            break;
          }

          case 'message:delete': {
            const { conversationId, messageId, forEveryone } = event;
            const conv = store.getConversation(conversationId);
            const existing = conv?.messages.find(m => m.id === messageId);
            if (existing?.status === 'scheduled' && existing.senderId === userId) {
              clearScheduledTimer(conversationId, messageId);
              if (store.removeScheduledMessage(conversationId, messageId, userId)) {
                sendToUser(userId, { type: 'message:removed', conversationId, messageId });
              }
              break;
            }
            const updated = store.deleteMessage(conversationId, messageId, userId, !!forEveryone);
            if (conv && updated) {
              if (forEveryone) {
                broadcastToMembers(conv.memberIds, {
                  type: 'message:updated',
                  conversationId,
                  message: updated,
                });
              } else {
                sendToUser(userId, {
                  type: 'message:updated',
                  conversationId,
                  message: updated,
                });
              }
            }
            break;
          }

          case 'message:react': {
            const { conversationId, messageId, emoji } = event;
            const conv = store.getConversation(conversationId);
            const updated = store.toggleReaction(conversationId, messageId, userId, emoji);
            if (conv && updated) {
              if (updated.status === 'scheduled') {
                sendToUser(userId, { type: 'message:updated', conversationId, message: updated });
              } else {
                broadcastToMembers(conv.memberIds, {
                  type: 'message:updated',
                  conversationId,
                  message: updated,
                });
              }
            }
            break;
          }

          case 'message:star': {
            const { conversationId, messageId } = event;
            const updated = store.toggleStar(conversationId, messageId, userId);
            if (updated) {
              sendToUser(userId, {
                type: 'message:updated',
                conversationId,
                message: updated,
              });
            }
            break;
          }

          case 'poll:vote': {
            const { conversationId, messageId, optionIndex } = event;
            const conv = store.getConversation(conversationId);
            const updated = store.votePoll(conversationId, messageId, userId, optionIndex);
            if (conv && updated) {
              broadcastToMembers(conv.memberIds, {
                type: 'message:updated',
                conversationId,
                message: updated,
              });
            }
            break;
          }

          case 'message:view_once': {
            const { conversationId, messageId } = event;
            const conv = store.getConversation(conversationId);
            const updated = store.markViewOnceOpened(conversationId, messageId);
            if (conv && updated) {
              broadcastToMembers(conv.memberIds, {
                type: 'message:updated',
                conversationId,
                message: updated,
              });
            }
            break;
          }

          case 'group:create': {
            const { title, memberIds, adminIds, about } = event;
            const conv = store.createGroup(userId, title, memberIds || [], adminIds || [], about);
            syncConversationToMembers(conv.id, conv.memberIds);
            break;
          }

          case 'group:add_members': {
            const { conversationId, memberIds, adminIds } = event;
            const conv = store.addGroupMembers(conversationId, userId, memberIds || [], adminIds || []);
            if (conv) {
              syncConversationToMembers(conv.id, conv.memberIds);
            } else {
              sendToUser(userId, { type: 'toast', message: 'فقط مشرفو المجموعة يمكنهم إضافة أعضاء جدد' });
            }
            break;
          }

          case 'group:remove_member': {
            const { conversationId, targetUserId } = event;
            const res = store.removeGroupMember(conversationId, userId, targetUserId);
            if (res) {
              syncConversationToMembers(res.conv.id, res.conv.memberIds);
              sendToUser(res.removedUserId, { type: 'conversation:removed', conversationId });
            } else {
              sendToUser(userId, { type: 'toast', message: 'تعذر إزالة العضو — صلاحية المشرف مطلوبة' });
            }
            break;
          }

          case 'group:toggle_admin': {
            const { conversationId, targetUserId } = event;
            const res = store.toggleGroupAdmin(conversationId, userId, targetUserId);
            if (res) {
              syncConversationToMembers(res.conv.id, res.conv.memberIds);
            } else {
              sendToUser(userId, {
                type: 'toast',
                message: 'تعذر تعديل الإشراف (يجب بقاء مشرف واحد على الأقل)',
              });
            }
            break;
          }

          case 'group:update_info': {
            const { conversationId, title, about } = event;
            const conv = store.updateGroupInfo(conversationId, userId, { title, about });
            if (conv) {
              syncConversationToMembers(conv.id, conv.memberIds);
            } else {
              sendToUser(userId, {
                type: 'toast',
                message: 'فقط مشرفو المجموعة يمكنهم تعديل معلومات المجموعة',
              });
            }
            break;
          }

          case 'user:privacy': {
            const { lastSeenPrivacy } = event;
            const updated = store.updateUserProfile(userId, { lastSeenPrivacy });
            if (updated) {
              broadcastAll({ type: 'user:updated', user: updated });
            }
            break;
          }

          case 'dm:ensure': {
            const { targetUserId } = event;
            const conv = store.ensureDmConversation(userId, targetUserId);
            syncConversationToMembers(conv.id, conv.memberIds);
            break;
          }

          case 'chat:prefs': {
            const { conversationId, action } = event;
            const updated = store.updateConversationPrefs(conversationId, userId, action);
            if (updated) {
              const filtered = store.getConversationForUser(conversationId, userId);
              if (filtered) {
                sendToUser(userId, {
                  type: 'conversation:sync',
                  conversation: filtered,
                });
              }
            }
            break;
          }

          case 'status:add': {
            const user = store.getUser(userId);
            if (!user) break;
            const rawMediaType = event.mediaType === 'video' || event.mediaType === 'image' ? event.mediaType : (event.mediaUrl ? 'image' : 'text');
            const parsedDuration = typeof event.videoDuration === 'number' && Number.isFinite(event.videoDuration)
              ? Math.round(event.videoDuration)
              : undefined;
            if (rawMediaType === 'video' && parsedDuration && parsedDuration > 180) {
              sendToUser(userId, {
                type: 'toast',
                message: 'الحد الأقصى لمدة فيديو الحالة هو 3 دقائق (180 ثانية)',
              });
              break;
            }
            const now = Date.now();
            const pinImmediately = !!event.pinImmediately;
            const privacy: StoredStatus['privacy'] =
              event.privacy === 'contacts' || event.privacy === 'private' ? event.privacy : 'everyone';
            const st = store.addStatus({
              id: 's-' + now,
              userId,
              userName: user.name,
              avatar: user.avatar,
              text: event.text,
              mediaUrl: event.mediaUrl,
              mediaType: rawMediaType,
              videoDuration: parsedDuration,
              bgGradient: event.bgGradient,
              fontStyle: event.fontStyle || 'classic',
              privacy,
              pinnedBy: pinImmediately ? [userId] : [],
              pinnedTimestamps: pinImmediately ? { [userId]: now } : {},
              reactions: [],
              timestamp: 'الآن',
              createdAt: now,
              expiresAt: now + 24 * 60 * 60 * 1000,
              viewedBy: [],
            });
            if (privacy === 'private') {
              sendToUser(userId, { type: 'status:new', status: st });
            } else if (privacy === 'contacts') {
              for (const onlineId of getOnlineUserIds()) {
                if (onlineId === userId || store.getStatusesForUser(onlineId).some(item => item.id === st.id)) {
                  sendToUser(onlineId, { type: 'status:new', status: st });
                }
              }
            } else {
              broadcastAll({ type: 'status:new', status: st });
            }
            break;
          }

          case 'status:delete': {
            if (store.deleteStatus(event.statusId, userId)) {
              broadcastAll({ type: 'status:deleted', statusId: event.statusId });
            }
            break;
          }

          case 'status:view': {
            const st = store.markStatusViewed(event.statusId, userId);
            if (st) {
              broadcastAll({ type: 'status:updated', status: st });
            }
            break;
          }

          case 'status:pin': {
            const st = store.toggleStatusPin(event.statusId, userId);
            if (st) {
              sendToUser(userId, { type: 'status:updated', status: st });
            }
            break;
          }

          case 'status:react': {
            const st = store.reactToStatus(event.statusId, userId, String(event.emoji || ''));
            if (st) {
              broadcastAll({ type: 'status:updated', status: st });
            }
            break;
          }

          case 'call:signal': {
            const { targetUserId, signalType, callType, callId, duration } = event;
            if (signalType === 'invite') {
              sendToUser(targetUserId, {
                type: 'call:incoming',
                callId,
                callerId: userId,
                callType,
              });
            } else if (signalType === 'accept') {
              sendToUser(targetUserId, { type: 'call:accepted', callId });
            } else if (signalType === 'reject') {
              sendToUser(targetUserId, { type: 'call:rejected', callId });
              const rec = store.addCallRecord({
                id: 'cr-' + Date.now(),
                callerId: targetUserId,
                calleeId: userId,
                type: callType || 'voice',
                status: 'rejected',
                timestamp: 'الآن',
              });
              broadcastToMembers([userId, targetUserId], { type: 'call:record', record: rec });
            } else if (signalType === 'end') {
              sendToUser(targetUserId, { type: 'call:ended', callId });
              const dur = Number(duration || 0);
              const formatted =
                dur > 0
                  ? `${String(Math.floor(dur / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`
                  : undefined;
              const rec = store.addCallRecord({
                id: 'cr-' + Date.now(),
                callerId: userId,
                calleeId: targetUserId,
                type: callType || 'voice',
                status: dur > 0 ? 'completed' : 'missed',
                timestamp: 'الآن',
                duration: formatted,
              });
              broadcastToMembers([userId, targetUserId], { type: 'call:record', record: rec });
            }
            break;
          }

          case 'calls:clear': {
            store.clearCallsForUser(userId);
            sendToUser(userId, { type: 'calls:cleared' });
            break;
          }

          case 'contacts:sync_batch': {
            const incoming = Array.isArray(event.contacts) ? event.contacts : [];
            const res = store.syncContactsForUser(userId, incoming);
            for (const c of res.contacts) {
              if (c.registeredUserId) {
                const conv = store.ensureDmConversation(userId, c.registeredUserId);
                syncConversationToMembers(conv.id, conv.memberIds);
              }
            }
            sendToUser(userId, {
              type: 'contacts:synced',
              contacts: res.contacts,
              lastSyncAt: res.lastSyncAt,
              summary: {
                addedCount: res.addedCount,
                updatedCount: res.updatedCount,
                matchedCount: res.matchedCount,
              },
            });
            break;
          }

          case 'contacts:resync': {
            const res = store.resyncContactsForUser(userId);
            for (const c of res.contacts) {
              if (c.registeredUserId) {
                const conv = store.ensureDmConversation(userId, c.registeredUserId);
                syncConversationToMembers(conv.id, conv.memberIds);
              }
            }
            sendToUser(userId, {
              type: 'contacts:synced',
              contacts: res.contacts,
              lastSyncAt: res.lastSyncAt,
              summary: {
                addedCount: 0,
                updatedCount: res.contacts.length,
                matchedCount: res.matchedCount,
              },
            });
            break;
          }

          case 'contacts:delete': {
            const contacts = store.deleteSyncedContact(userId, event.contactId);
            sendToUser(userId, {
              type: 'contacts:synced',
              contacts,
              lastSyncAt: store.getLastContactSyncAt(userId),
            });
            break;
          }

          case 'contacts:clear': {
            const contacts = store.clearSyncedContacts(userId);
            sendToUser(userId, {
              type: 'contacts:synced',
              contacts,
              lastSyncAt: null,
            });
            break;
          }

          case 'channel:follow': {
            const channels = store.toggleFollowChannel(event.channelId, userId);
            broadcastAll({ type: 'channels:updated', channels });
            break;
          }

          case 'channel:react': {
            const channels = store.toggleChannelPostReaction(event.channelId, event.postId, userId);
            broadcastAll({ type: 'channels:updated', channels });
            break;
          }

          case 'channel:post': {
            const channels = store.addChannelPost(event.channelId, userId, event.text || '');
            broadcastAll({ type: 'channels:updated', channels });
            break;
          }

          case 'channel:create': {
            const channels = store.createChannel(userId, event.name || '');
            broadcastAll({ type: 'channels:updated', channels });
            break;
          }

          case 'community:create': {
            const { name, description } = event;
            if (!name || !String(name).trim()) break;
            const res = store.createCommunity(userId, String(name), String(description || ''));
            syncConversationToMembers(res.conversation.id, res.conversation.memberIds);
            broadcastAll({ type: 'communities:updated', communities: res.communities });
            break;
          }
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (sessionId) {
        const sSet = sessionSockets.get(sessionId);
        if (sSet) {
          sSet.delete(ws);
          if (sSet.size === 0) sessionSockets.delete(sessionId);
        }
      }
      const set = userSockets.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          userSockets.delete(userId);
          store.updateUserProfile(userId, {
            lastSeen: `آخر ظهور ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
          });
        }
      }
      broadcastAll({
        type: 'presence:update',
        onlineUserIds: getOnlineUserIds(),
      });
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Re-arm persisted scheduled messages on startup + periodic fallback sweep
  for (const item of store.getPendingScheduledMessages()) {
    armScheduledTimer(item.conversationId, item.message);
  }
  setInterval(() => {
    const now = Date.now();
    for (const item of store.getPendingScheduledMessages()) {
      if (typeof item.message.scheduledAt === 'number' && item.message.scheduledAt <= now) {
        triggerScheduledDispatch(item.conversationId, item.message.id);
      }
    }
  }, 3000);

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server + WebSocket running on http://localhost:${port}`);
  });
}

startServer();
