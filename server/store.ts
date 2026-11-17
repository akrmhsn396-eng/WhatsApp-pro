/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  email?: string;
  about: string;
  avatar: string;
  lastSeen: string;
  lastSeenPrivacy?: 'everyone' | 'contacts' | 'nobody';
  phoneVerified?: boolean;
  twoFactorPinHash?: string;
  hasTwoFactor?: boolean;
  registeredAt?: number;
}

export interface AuthChallenge {
  challengeId: string;
  phone: string;
  codeHash: string;
  channel: 'sms' | 'call';
  purpose: 'login' | 'change_phone';
  userId?: string;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
  verified: boolean;
  pending2faToken?: string;
  onboardingToken?: string;
  matchedUserId?: string;
}

export interface AuthSession {
  id: string;
  token: string;
  userId: string;
  phone: string;
  deviceName: string;
  userAgent?: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
}

export interface StoredReaction {
  emoji: string;
  userIds: string[];
}

export interface StoredPollOption {
  text: string;
  voterIds: string[];
}

export interface StoredLinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  domain?: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: string;
  createdAt: number;
  scheduledAt?: number;
  status: 'scheduled' | 'sent' | 'delivered' | 'read';
  type?: 'text' | 'image' | 'audio' | 'document' | 'poll' | 'contact' | 'location';
  mediaUrl?: string;
  mediaUrls?: string[];
  audioUrl?: string;
  audioDuration?: number;
  fileName?: string;
  fileSize?: string;
  contactCard?: { name: string; phone: string; avatar: string };
  locationData?: { title: string; subtitle: string; coords: string };
  linkPreview?: StoredLinkPreview;
  skipLinkPreview?: boolean;
  isViewOnce?: boolean;
  isViewedOnce?: boolean;
  reactions?: StoredReaction[];
  replyTo?: { id: string; senderName: string; text: string };
  starredBy?: string[];
  deletedFor?: string[];
  isDeletedForAll?: boolean;
  isEdited?: boolean;
  isForwarded?: boolean;
  readBy?: string[];
  pollData?: {
    question: string;
    allowMultiple?: boolean;
    options: StoredPollOption[];
  };
}

export interface StoredConversation {
  id: string;
  kind: 'dm' | 'group' | 'ai';
  title?: string;
  avatar?: string;
  about?: string;
  memberIds: string[];
  adminIds?: string[];
  disappearing?: 'off' | '24h' | '7d' | '90d';
  pinnedBy?: string[];
  archivedBy?: string[];
  mutedBy?: string[];
  lockedBy?: string[];
  favoriteBy?: string[];
  blockedBy?: string[];
  notificationTones?: Record<string, string>;
  messages: StoredMessage[];
}

export interface StoredStatus {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'video';
  videoDuration?: number;
  bgGradient?: string;
  fontStyle?: 'classic' | 'bold' | 'typewriter' | 'serif';
  privacy?: 'everyone' | 'contacts' | 'private';
  pinnedBy?: string[];
  pinnedTimestamps?: Record<string, number>;
  reactions?: StoredReaction[];
  timestamp: string;
  createdAt: number;
  expiresAt?: number;
  viewedBy: string[];
}

export interface StoredCallRecord {
  id: string;
  callerId: string;
  calleeId: string;
  type: 'voice' | 'video';
  status: 'completed' | 'missed' | 'rejected';
  timestamp: string;
  duration?: string;
}

export interface SyncedContact {
  id: string;
  ownerUserId: string;
  displayName: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  source: 'device' | 'vcf' | 'csv' | 'manual' | 'sync';
  registeredUserId?: string;
  syncedAt: number;
}

export interface StoredChannelPost {
  id: string;
  text: string;
  timestamp: string;
  baseReactions: number;
  reactedBy: string[];
}

export interface StoredChannel {
  id: string;
  name: string;
  avatar: string;
  baseFollowers: number;
  followerIds: string[];
  verified?: boolean;
  ownerId?: string;
  posts: StoredChannelPost[];
}

export interface StoredCommunityGroup {
  id: string;
  conversationId?: string;
  name: string;
  lastMessage: string;
  time: string;
}

export interface StoredCommunity {
  id: string;
  name: string;
  description: string;
  avatar: string;
  ownerId: string;
  memberIds: string[];
  groups: StoredCommunityGroup[];
}

export interface DatabaseSchema {
  users: UserAccount[];
  conversations: StoredConversation[];
  statuses: StoredStatus[];
  calls: StoredCallRecord[];
  channels: StoredChannel[];
  communities: StoredCommunity[];
  syncedContacts: SyncedContact[];
  lastContactSyncByUser: Record<string, number>;
  authChallenges: AuthChallenge[];
  authSessions: AuthSession[];
}

export function getDmConversationId(userA: string, userB: string): string {
  return `dm:${[userA, userB].sort().join(':')}`;
}

export function normalizePhoneNumber(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.includes('@')) return '';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const easternDigits = '۰۱۲۳۴۵۶۷۸۹';
  let normalized = trimmed;
  normalized = normalized.replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)));
  normalized = normalized.replace(/[۰-۹]/g, d => String(easternDigits.indexOf(d)));
  const hasPlus = normalized.startsWith('+');
  let digits = normalized.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    return '+' + digits;
  }
  if (hasPlus) {
    return '+' + digits;
  }
  // Local 05xxxxxxxx -> +9665xxxxxxxx heuristic while keeping trailing match safe
  if (digits.startsWith('05') && digits.length === 10) {
    return '+966' + digits.slice(1);
  }
  return digits.startsWith('966') && digits.length >= 12 ? '+' + digits : digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const ta = (a || '').trim().toLowerCase();
  const tb = (b || '').trim().toLowerCase();
  if (!ta || !tb) return false;
  if (ta.includes('@') || tb.includes('@')) {
    return ta.includes('@') && tb.includes('@') && ta === tb;
  }
  const na = normalizePhoneNumber(a).replace(/\+/g, '');
  const nb = normalizePhoneNumber(b).replace(/\+/g, '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 9 && nb.length >= 9) {
    return na.slice(-9) === nb.slice(-9);
  }
  return false;
}

const DEFAULT_DATA: DatabaseSchema = {
  users: [],
  conversations: [],
  statuses: [],
  calls: [],
  channels: [],
  communities: [],
  syncedContacts: [],
  lastContactSyncByUser: {},
  authChallenges: [],
  authSessions: [],
};

class PersistentStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    const filesToTry = [STORE_FILE, path.join(DATA_DIR, 'store.json.bak')];
    for (const filePath of filesToTry) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw) as DatabaseSchema;
          if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.conversations)) {
            for (const conv of parsed.conversations) {
              if (conv.kind === 'group' && (!Array.isArray(conv.adminIds) || conv.adminIds.length === 0)) {
                conv.adminIds = conv.memberIds.length > 0 ? [conv.memberIds[0]] : [];
              }
            }
            if (!Array.isArray(parsed.channels)) {
              parsed.channels = structuredClone(DEFAULT_DATA.channels);
            }
            if (!Array.isArray(parsed.communities)) {
              parsed.communities = structuredClone(DEFAULT_DATA.communities);
            }
            if (!Array.isArray(parsed.syncedContacts)) {
              parsed.syncedContacts = structuredClone(DEFAULT_DATA.syncedContacts);
            }
            if (!parsed.lastContactSyncByUser || typeof parsed.lastContactSyncByUser !== 'object') {
              parsed.lastContactSyncByUser = structuredClone(DEFAULT_DATA.lastContactSyncByUser);
            }
            if (!Array.isArray(parsed.authChallenges)) {
              parsed.authChallenges = [];
            }
            if (!Array.isArray(parsed.authSessions)) {
              parsed.authSessions = [];
            }
            console.log(`Successfully loaded store data from ${filePath}`);
            return parsed;
          }
        }
      } catch (err) {
        console.error(`Failed loading from ${filePath}:`, err);
      }
    }
    this.save(DEFAULT_DATA);
    return structuredClone(DEFAULT_DATA);
  }

  private save(snapshot?: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataStr = JSON.stringify(snapshot || this.data, null, 2);
      fs.writeFileSync(STORE_FILE, dataStr, 'utf-8');
      fs.writeFileSync(path.join(DATA_DIR, 'store.json.bak'), dataStr, 'utf-8');
    } catch (err) {
      console.error('Failed saving store.json:', err);
    }
  }

  public reset(): DatabaseSchema {
    this.data = structuredClone(DEFAULT_DATA);
    this.save();
    return this.data;
  }

  public sanitizeUser(u: UserAccount): UserAccount {
    const { twoFactorPinHash, ...rest } = u;
    const email = u.email || (u.phone && u.phone.includes('@') ? u.phone : undefined);
    return {
      ...rest,
      email,
      phoneVerified: u.phoneVerified ?? true,
      hasTwoFactor: !!twoFactorPinHash,
    };
  }

  public getUsers(): UserAccount[] {
    return this.data.users.map(u => this.sanitizeUser(u));
  }

  public getUser(userId: string): UserAccount | undefined {
    const u = this.data.users.find(x => x.id === userId);
    return u ? this.sanitizeUser(u) : undefined;
  }

  public getRawUser(userId: string): UserAccount | undefined {
    return this.data.users.find(x => x.id === userId);
  }

  public getAllRawUsers(): UserAccount[] {
    return this.data.users;
  }

  public findUserByPhone(phone: string): UserAccount | undefined {
    return this.data.users.find(u => phonesMatch(u.phone, phone));
  }

  public findUserByEmail(email: string): UserAccount | undefined {
    if (!email) return undefined;
    const clean = email.trim().toLowerCase();
    const u = this.data.users.find(x => (x.email && x.email.toLowerCase() === clean) || (x.phone && x.phone.toLowerCase() === clean));
    return u ? this.sanitizeUser(u) : undefined;
  }

  public registerUser(
    name: string,
    phone: string,
    avatar?: string,
    about?: string,
    phoneVerified = false,
    email?: string,
    explicitId?: string
  ): UserAccount {
    const derivedEmail = email?.trim().toLowerCase() || (phone.includes('@') ? phone.trim().toLowerCase() : undefined);
    const existing = this.data.users.find(u =>
      (explicitId && u.id === explicitId) ||
      phonesMatch(u.phone, phone) ||
      (derivedEmail && ((u.email && u.email.toLowerCase() === derivedEmail) || u.phone.toLowerCase() === derivedEmail))
    );
    if (existing) {
      if (phoneVerified && !existing.phoneVerified) {
        existing.phoneVerified = true;
      }
      if (derivedEmail && !existing.email) {
        existing.email = derivedEmail;
      }
      this.save();
      return this.sanitizeUser(existing);
    }

    const user: UserAccount = {
      id: explicitId || 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      name: name.trim(),
      phone: phone.trim(),
      email: derivedEmail,
      about: about?.trim() || 'مرحباً! أستخدم WhatsApp Pro AI',
      avatar: avatar || '',
      lastSeen: 'الآن',
      phoneVerified,
      registeredAt: Date.now(),
    };
    this.data.users.push(user);
    // Ensure AI conversation exists for new user
    this.ensureAiConversation(user.id);

    // Auto-match newly registered user across all users' synced contacts
    for (const sc of this.data.syncedContacts) {
      if (!sc.registeredUserId && sc.ownerUserId !== user.id && phonesMatch(sc.phone, user.phone)) {
        sc.registeredUserId = user.id;
        this.ensureDmConversation(sc.ownerUserId, user.id);
      }
    }

    this.save();
    return this.sanitizeUser(user);
  }

  public updateUserProfile(
    userId: string,
    patch: Partial<Pick<UserAccount, 'name' | 'about' | 'avatar' | 'lastSeen' | 'lastSeenPrivacy' | 'phoneVerified'>>
  ): UserAccount | undefined {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return undefined;
    Object.assign(user, patch);
    this.save();
    return this.sanitizeUser(user);
  }

  public setUserTwoFactorPin(userId: string, pinHash: string | undefined): UserAccount | undefined {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return undefined;
    if (pinHash) {
      user.twoFactorPinHash = pinHash;
    } else {
      delete user.twoFactorPinHash;
    }
    this.save();
    return this.sanitizeUser(user);
  }

  public changeUserPhone(userId: string, newPhone: string): { user: UserAccount; affectedOwners: string[] } | undefined {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return undefined;
    user.phone = newPhone;
    user.phoneVerified = true;

    for (const sess of this.data.authSessions) {
      if (sess.userId === userId) {
        sess.phone = newPhone;
      }
    }

    const affectedOwners = new Set<string>();
    for (const sc of this.data.syncedContacts) {
      if (sc.ownerUserId !== userId && phonesMatch(sc.phone, newPhone)) {
        sc.registeredUserId = userId;
        this.ensureDmConversation(sc.ownerUserId, userId);
        affectedOwners.add(sc.ownerUserId);
      }
    }

    this.save();
    return { user: this.sanitizeUser(user), affectedOwners: Array.from(affectedOwners) };
  }

  /* ---------- Phone Auth Challenges & Sessions ---------- */
  public createAuthChallenge(challenge: AuthChallenge): AuthChallenge {
    const now = Date.now();
    // Prune stale challenges older than 30 minutes
    this.data.authChallenges = this.data.authChallenges.filter(c => now - c.createdAt < 30 * 60 * 1000);
    this.data.authChallenges.push(challenge);
    this.save();
    return challenge;
  }

  public getAuthChallenge(challengeId: string): AuthChallenge | undefined {
    return this.data.authChallenges.find(c => c.challengeId === challengeId);
  }

  public getRecentChallengesForPhone(phone: string, windowMs: number): AuthChallenge[] {
    const cutoff = Date.now() - windowMs;
    return this.data.authChallenges.filter(c => c.createdAt >= cutoff && phonesMatch(c.phone, phone));
  }

  public updateAuthChallenge(challengeId: string, patch: Partial<AuthChallenge>): AuthChallenge | undefined {
    const ch = this.data.authChallenges.find(c => c.challengeId === challengeId);
    if (!ch) return undefined;
    Object.assign(ch, patch);
    this.save();
    return ch;
  }

  public findChallengeByPending2faToken(token: string): AuthChallenge | undefined {
    return this.data.authChallenges.find(c => c.pending2faToken === token);
  }

  public findChallengeByOnboardingToken(token: string): AuthChallenge | undefined {
    return this.data.authChallenges.find(c => c.onboardingToken === token);
  }

  public createAuthSession(session: AuthSession): AuthSession {
    const now = Date.now();
    this.data.authSessions = this.data.authSessions.filter(s => s.expiresAt > now);
    this.data.authSessions.unshift(session);
    this.save();
    return session;
  }

  public getAuthSessionByToken(token: string): AuthSession | undefined {
    if (!token) return undefined;
    const now = Date.now();
    const sess = this.data.authSessions.find(s => s.token === token && s.expiresAt > now);
    return sess;
  }

  public touchAuthSession(token: string): AuthSession | undefined {
    const sess = this.getAuthSessionByToken(token);
    if (!sess) return undefined;
    sess.lastActiveAt = Date.now();
    this.save();
    return sess;
  }

  public getAuthSessionsForUser(userId: string): AuthSession[] {
    const now = Date.now();
    return this.data.authSessions
      .filter(s => s.userId === userId && s.expiresAt > now)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }

  public revokeAuthSessionById(sessionId: string, userId: string): AuthSession | undefined {
    const idx = this.data.authSessions.findIndex(s => s.id === sessionId && s.userId === userId);
    if (idx < 0) return undefined;
    const [removed] = this.data.authSessions.splice(idx, 1);
    this.save();
    return removed;
  }

  public revokeAuthSessionByToken(token: string): AuthSession | undefined {
    const idx = this.data.authSessions.findIndex(s => s.token === token);
    if (idx < 0) return undefined;
    const [removed] = this.data.authSessions.splice(idx, 1);
    this.save();
    return removed;
  }

  public revokeOtherAuthSessions(userId: string, keepSessionId: string): AuthSession[] {
    const removed = this.data.authSessions.filter(s => s.userId === userId && s.id !== keepSessionId);
    if (removed.length > 0) {
      this.data.authSessions = this.data.authSessions.filter(
        s => s.userId !== userId || s.id === keepSessionId
      );
      this.save();
    }
    return removed;
  }

  public ensureAiConversation(userId: string): StoredConversation {
    const convId = `ai:${userId}`;
    let conv = this.data.conversations.find(c => c.id === convId);
    if (!conv) {
      conv = {
        id: convId,
        kind: 'ai',
        title: 'Meta AI · مساعد واتساب الذكي',
        memberIds: [userId],
        pinnedBy: [userId],
        favoriteBy: [userId],
        messages: [
          {
            id: `m-ai-welcome-${userId}`,
            conversationId: convId,
            senderId: 'meta-ai',
            senderName: 'Meta AI',
            text: 'أهلاً بك! أنا Meta AI داخل واتساب.\nيمكنني مساعدتك في كتابة الرسائل، تلخيص النصوص، الترجمة الفورية، أو الإجابة عن أي سؤال.',
            timestamp: 'الآن',
            createdAt: Date.now(),
            status: 'read',
          },
        ],
      };
      this.data.conversations.unshift(conv);
      this.save();
    }
    return conv;
  }

  public ensureDmConversation(userA: string, userB: string): StoredConversation {
    const convId = getDmConversationId(userA, userB);
    let conv = this.data.conversations.find(c => c.id === convId);
    if (!conv) {
      conv = {
        id: convId,
        kind: 'dm',
        memberIds: [userA, userB],
        messages: [],
      };
      this.data.conversations.push(conv);
      this.save();
    }
    return conv;
  }

  public createGroup(
    creatorId: string,
    title: string,
    memberIds: string[],
    adminIds?: string[],
    about?: string
  ): StoredConversation {
    const uniqueMembers = Array.from(new Set([creatorId, ...memberIds]));
    const uniqueAdmins = Array.from(
      new Set([creatorId, ...(adminIds || []).filter(id => uniqueMembers.includes(id))])
    );
    const creator = this.getUser(creatorId);
    const convId = `group:g-${Date.now()}`;
    const conv: StoredConversation = {
      id: convId,
      kind: 'group',
      title: title.trim(),
      avatar: '/src/assets/images/avatar_group_devs_1794862076550.jpg',
      about: about?.trim() || 'مجموعة جديدة',
      memberIds: uniqueMembers,
      adminIds: uniqueAdmins,
      messages: [
        {
          id: `mg-${Date.now()}`,
          conversationId: convId,
          senderId: 'system',
          senderName: 'النظام',
          text: `أنشأ ${creator?.name || 'أحد الأعضاء'} المجموعة "${title.trim()}" (${uniqueMembers.length} أعضاء)`,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          createdAt: Date.now(),
          status: 'read',
        },
      ],
    };
    this.data.conversations.unshift(conv);
    this.save();
    return conv;
  }

  public addGroupMembers(
    convId: string,
    actorId: string,
    newMemberIds: string[],
    newAdminIds?: string[]
  ): StoredConversation | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv || conv.kind !== 'group') return null;
    conv.adminIds = conv.adminIds && conv.adminIds.length > 0 ? conv.adminIds : conv.memberIds.slice(0, 1);
    if (!conv.adminIds.includes(actorId)) return null;

    const toAdd = Array.from(new Set(newMemberIds)).filter(
      id => !conv.memberIds.includes(id) && !!this.getUser(id)
    );
    if (toAdd.length === 0) return null;

    conv.memberIds.push(...toAdd);
    if (Array.isArray(newAdminIds) && newAdminIds.length > 0) {
      for (const admId of newAdminIds) {
        if (conv.memberIds.includes(admId) && !conv.adminIds.includes(admId)) {
          conv.adminIds.push(admId);
        }
      }
    }

    const actor = this.getUser(actorId);
    const addedNames = toAdd.map(id => this.getUser(id)?.name || id).join('، ');
    conv.messages.push({
      id: `mg-add-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      conversationId: convId,
      senderId: 'system',
      senderName: 'النظام',
      text: `أضاف ${actor?.name || 'المشرف'} كلاً من: ${addedNames}`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'read',
    });

    this.save();
    return conv;
  }

  public removeGroupMember(
    convId: string,
    actorId: string,
    targetUserId: string
  ): { conv: StoredConversation; removedUserId: string } | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv || conv.kind !== 'group' || !conv.memberIds.includes(targetUserId)) return null;
    conv.adminIds = conv.adminIds && conv.adminIds.length > 0 ? conv.adminIds : conv.memberIds.slice(0, 1);

    const isActorAdmin = conv.adminIds.includes(actorId);
    if (actorId !== targetUserId && !isActorAdmin) return null;

    conv.memberIds = conv.memberIds.filter(id => id !== targetUserId);
    conv.adminIds = conv.adminIds.filter(id => id !== targetUserId);

    if (conv.adminIds.length === 0 && conv.memberIds.length > 0) {
      conv.adminIds.push(conv.memberIds[0]);
    }

    const actor = this.getUser(actorId);
    const target = this.getUser(targetUserId);
    conv.messages.push({
      id: `mg-rem-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      conversationId: convId,
      senderId: 'system',
      senderName: 'النظام',
      text:
        actorId === targetUserId
          ? `غادر ${target?.name || 'أحد الأعضاء'} المجموعة`
          : `أزال ${actor?.name || 'المشرف'} العضو ${target?.name || targetUserId}`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'read',
    });

    this.save();
    return { conv, removedUserId: targetUserId };
  }

  public toggleGroupAdmin(
    convId: string,
    actorId: string,
    targetUserId: string
  ): { conv: StoredConversation; becameAdmin: boolean } | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv || conv.kind !== 'group' || !conv.memberIds.includes(targetUserId)) return null;
    conv.adminIds = conv.adminIds && conv.adminIds.length > 0 ? conv.adminIds : conv.memberIds.slice(0, 1);
    if (!conv.adminIds.includes(actorId)) return null;

    const isCurrentlyAdmin = conv.adminIds.includes(targetUserId);
    if (isCurrentlyAdmin) {
      if (conv.adminIds.length <= 1) return null; // Keep at least 1 admin
      conv.adminIds = conv.adminIds.filter(id => id !== targetUserId);
    } else {
      conv.adminIds.push(targetUserId);
    }

    const target = this.getUser(targetUserId);
    conv.messages.push({
      id: `mg-adm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      conversationId: convId,
      senderId: 'system',
      senderName: 'النظام',
      text: isCurrentlyAdmin
        ? `تمت إزالة صلاحية الإشراف عن ${target?.name || targetUserId}`
        : `تم تعيين ${target?.name || targetUserId} مشرفاً للمجموعة`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'read',
    });

    this.save();
    return { conv, becameAdmin: !isCurrentlyAdmin };
  }

  public updateGroupInfo(
    convId: string,
    actorId: string,
    patch: { title?: string; about?: string }
  ): StoredConversation | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv || conv.kind !== 'group') return null;
    conv.adminIds = conv.adminIds && conv.adminIds.length > 0 ? conv.adminIds : conv.memberIds.slice(0, 1);
    if (!conv.adminIds.includes(actorId)) return null;

    if (patch.title && patch.title.trim()) {
      conv.title = patch.title.trim();
    }
    if (typeof patch.about === 'string') {
      conv.about = patch.about.trim() || 'مجموعة محادثة';
    }
    const actor = this.getUser(actorId);
    conv.messages.push({
      id: `mg-info-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      conversationId: convId,
      senderId: 'system',
      senderName: 'النظام',
      text: `قام ${actor?.name || 'المشرف'} بتحديث معلومات المجموعة`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'read',
    });
    this.save();
    return conv;
  }

  public pruneExpiredMessages(): string[] {
    const durationMsMap: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };
    const now = Date.now();
    const affectedConvIds: string[] = [];
    for (const conv of this.data.conversations) {
      const ttl = conv.disappearing ? durationMsMap[conv.disappearing] : 0;
      if (!ttl) continue;
      const before = conv.messages.length;
      conv.messages = conv.messages.filter(m => {
        if (m.status === 'scheduled' || m.senderId === 'system') return true;
        if (!m.createdAt) return true;
        return now - m.createdAt <= ttl;
      });
      if (conv.messages.length !== before) {
        affectedConvIds.push(conv.id);
      }
    }
    if (affectedConvIds.length > 0) this.save();
    return affectedConvIds;
  }

  public getConversationsForUser(userId: string): StoredConversation[] {
    this.ensureAiConversation(userId);
    for (const u of this.data.users) {
      if (u.id !== userId) {
        this.ensureDmConversation(userId, u.id);
      }
    }
    this.pruneExpiredMessages();
    return this.data.conversations
      .filter(c => c.memberIds.includes(userId))
      .map(c => ({
        ...c,
        messages: c.messages.filter(m => m.status !== 'scheduled' || m.senderId === userId),
      }));
  }

  public getConversationForUser(convId: string, userId: string): StoredConversation | undefined {
    const conv = this.data.conversations.find(c => c.id === convId && c.memberIds.includes(userId));
    if (!conv) return undefined;
    return {
      ...conv,
      messages: conv.messages.filter(m => m.status !== 'scheduled' || m.senderId === userId),
    };
  }

  public getConversation(convId: string): StoredConversation | undefined {
    return this.data.conversations.find(c => c.id === convId);
  }

  public addMessage(convId: string, msg: StoredMessage): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv) return null;
    // Idempotency check
    const existing = conv.messages.find(m => m.id === msg.id);
    if (existing) return existing;
    conv.messages.push(msg);
    this.save();
    return msg;
  }

  public markDeliveredForUser(userId: string): string[] {
    const updatedConvIds: string[] = [];
    for (const conv of this.data.conversations) {
      if (!conv.memberIds.includes(userId)) continue;
      let changed = false;
      for (const m of conv.messages) {
        if (m.senderId !== userId && m.status === 'sent') {
          m.status = 'delivered';
          changed = true;
        }
      }
      if (changed) updatedConvIds.push(conv.id);
    }
    if (updatedConvIds.length > 0) this.save();
    return updatedConvIds;
  }

  public markConversationRead(
    convId: string,
    readerId: string,
    sendReadReceipt = true
  ): { changed: boolean; statusUpdated: boolean } {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv) return { changed: false, statusUpdated: false };
    let changed = false;
    let statusUpdated = false;
    for (const m of conv.messages) {
      if (m.senderId !== readerId && m.status !== 'scheduled') {
        m.readBy = m.readBy || [];
        if (!m.readBy.includes(readerId)) {
          m.readBy.push(readerId);
          changed = true;
        }
        if ((sendReadReceipt || conv.kind === 'ai') && m.status !== 'read') {
          m.status = 'read';
          changed = true;
          statusUpdated = true;
        }
      }
    }
    if (changed) this.save();
    return { changed, statusUpdated };
  }

  public getPendingScheduledMessages(): Array<{ conversationId: string; message: StoredMessage }> {
    const list: Array<{ conversationId: string; message: StoredMessage }> = [];
    for (const conv of this.data.conversations) {
      for (const m of conv.messages) {
        if (m.status === 'scheduled' && typeof m.scheduledAt === 'number') {
          list.push({ conversationId: conv.id, message: m });
        }
      }
    }
    return list;
  }

  public dispatchScheduledMessage(
    convId: string,
    msgId: string,
    newStatus: 'sent' | 'delivered' | 'read'
  ): { conversation: StoredConversation; message: StoredMessage } | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!conv || !msg || msg.status !== 'scheduled') return null;

    const now = Date.now();
    msg.status = newStatus;
    msg.createdAt = now;
    msg.timestamp = new Date(now).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    this.save();
    return { conversation: conv, message: msg };
  }

  public removeScheduledMessage(convId: string, msgId: string, userId: string): boolean {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv) return false;
    const idx = conv.messages.findIndex(
      m => m.id === msgId && m.senderId === userId && m.status === 'scheduled'
    );
    if (idx < 0) return false;
    conv.messages.splice(idx, 1);
    this.save();
    return true;
  }

  public editMessage(convId: string, msgId: string, senderId: string, newText: string, linkPreview?: StoredLinkPreview): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg || msg.senderId !== senderId) return null;
    msg.text = newText;
    msg.isEdited = true;
    msg.linkPreview = linkPreview;
    this.save();
    return msg;
  }

  public attachLinkPreview(convId: string, msgId: string, linkPreview: StoredLinkPreview): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg || msg.isDeletedForAll || msg.skipLinkPreview) return null;
    msg.linkPreview = linkPreview;
    this.save();
    return msg;
  }

  public deleteMessage(convId: string, msgId: string, userId: string, forEveryone: boolean): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg) return null;
    if (forEveryone && msg.senderId === userId) {
      msg.isDeletedForAll = true;
      msg.text = '';
      msg.mediaUrl = undefined;
      msg.mediaUrls = undefined;
      msg.linkPreview = undefined;
    } else {
      msg.deletedFor = msg.deletedFor || [];
      if (!msg.deletedFor.includes(userId)) msg.deletedFor.push(userId);
    }
    this.save();
    return msg;
  }

  public toggleReaction(convId: string, msgId: string, userId: string, emoji: string): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg) return null;
    msg.reactions = msg.reactions || [];
    const idx = msg.reactions.findIndex(r => r.emoji === emoji);
    if (idx >= 0) {
      const has = msg.reactions[idx].userIds.includes(userId);
      if (has) {
        msg.reactions[idx].userIds = msg.reactions[idx].userIds.filter(id => id !== userId);
        if (msg.reactions[idx].userIds.length === 0) msg.reactions.splice(idx, 1);
      } else {
        msg.reactions[idx].userIds.push(userId);
      }
    } else {
      msg.reactions.push({ emoji, userIds: [userId] });
    }
    this.save();
    return msg;
  }

  public toggleStar(convId: string, msgId: string, userId: string): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg) return null;
    msg.starredBy = msg.starredBy || [];
    if (msg.starredBy.includes(userId)) {
      msg.starredBy = msg.starredBy.filter(id => id !== userId);
    } else {
      msg.starredBy.push(userId);
    }
    this.save();
    return msg;
  }

  public votePoll(convId: string, msgId: string, userId: string, optionIndex: number): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg || !msg.pollData) return null;
    const allowMultiple = !!msg.pollData.allowMultiple;
    msg.pollData.options.forEach((opt, idx) => {
      const voted = opt.voterIds.includes(userId);
      if (idx === optionIndex) {
        if (voted) opt.voterIds = opt.voterIds.filter(id => id !== userId);
        else opt.voterIds.push(userId);
      } else if (!allowMultiple && voted) {
        opt.voterIds = opt.voterIds.filter(id => id !== userId);
      }
    });
    this.save();
    return msg;
  }

  public markViewOnceOpened(convId: string, msgId: string): StoredMessage | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    const msg = conv?.messages.find(m => m.id === msgId);
    if (!msg) return null;
    msg.isViewedOnce = true;
    msg.mediaUrl = undefined;
    this.save();
    return msg;
  }

  public updateConversationPrefs(
    convId: string,
    userId: string,
    action: {
      toggle?: 'pin' | 'archive' | 'mute' | 'lock' | 'favorite' | 'block';
      disappearing?: 'off' | '24h' | '7d' | '90d';
      notificationTone?: string;
      clearForUser?: boolean;
    }
  ): StoredConversation | null {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (!conv) return null;

    if (action.toggle) {
      const keyMap = {
        pin: 'pinnedBy',
        archive: 'archivedBy',
        mute: 'mutedBy',
        lock: 'lockedBy',
        favorite: 'favoriteBy',
        block: 'blockedBy',
      } as const;
      const field = keyMap[action.toggle];
      const arr = (conv[field] = conv[field] || []);
      if (arr.includes(userId)) {
        conv[field] = arr.filter(id => id !== userId);
      } else {
        arr.push(userId);
      }
    }

    if (action.disappearing) {
      conv.disappearing = action.disappearing;
    }

    if (typeof action.notificationTone === 'string') {
      const allowed = new Set(['default', 'chime', 'crystal', 'pulse', 'marimba', 'aurora', 'silent']);
      const cleanTone = allowed.has(action.notificationTone) ? action.notificationTone : 'default';
      conv.notificationTones = conv.notificationTones || {};
      if (cleanTone === 'default') {
        delete conv.notificationTones[userId];
      } else {
        conv.notificationTones[userId] = cleanTone;
      }
    }

    if (action.clearForUser) {
      for (const m of conv.messages) {
        m.deletedFor = m.deletedFor || [];
        if (!m.deletedFor.includes(userId)) m.deletedFor.push(userId);
      }
    }

    this.save();
    return conv;
  }

  public getStatuses(): StoredStatus[] {
    return this.data.statuses;
  }

  public getStatusesForUser(viewerId: string): StoredStatus[] {
    const now = Date.now();
    const viewerSynced = new Set(
      this.data.syncedContacts
        .filter(sc => sc.ownerUserId === viewerId && sc.registeredUserId)
        .map(sc => sc.registeredUserId as string)
    );
    const viewerDmPeers = new Set<string>();
    for (const conv of this.data.conversations) {
      if (conv.kind === 'dm' && conv.memberIds.includes(viewerId)) {
        for (const m of conv.memberIds) {
          if (m !== viewerId) viewerDmPeers.add(m);
        }
      }
    }

    return this.data.statuses
      .filter(st => {
        const isPinnedByViewer = Array.isArray(st.pinnedBy) && st.pinnedBy.includes(viewerId);
        const notExpired = !st.expiresAt || st.expiresAt > now || isPinnedByViewer;
        if (!notExpired) return false;

        if (st.userId === viewerId) return true;
        const privacy = st.privacy || 'everyone';
        if (privacy === 'private') return false;
        if (privacy === 'contacts') {
          return viewerSynced.has(st.userId) || viewerDmPeers.has(st.userId);
        }
        return true;
      })
      .sort((a, b) => {
        const aPinned = Array.isArray(a.pinnedBy) && a.pinnedBy.includes(viewerId);
        const bPinned = Array.isArray(b.pinnedBy) && b.pinnedBy.includes(viewerId);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        if (aPinned && bPinned) {
          const ap = a.pinnedTimestamps?.[viewerId] || 0;
          const bp = b.pinnedTimestamps?.[viewerId] || 0;
          if (ap !== bp) return bp - ap;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  public addStatus(st: StoredStatus): StoredStatus {
    const now = st.createdAt || Date.now();
    const enriched: StoredStatus = {
      ...st,
      createdAt: now,
      expiresAt: st.expiresAt || now + 24 * 60 * 60 * 1000,
      pinnedBy: Array.isArray(st.pinnedBy) ? st.pinnedBy : [],
      pinnedTimestamps: st.pinnedTimestamps || {},
      reactions: Array.isArray(st.reactions) ? st.reactions : [],
    };
    this.data.statuses.unshift(enriched);
    this.save();
    return enriched;
  }

  public deleteStatus(statusId: string, userId: string): boolean {
    const idx = this.data.statuses.findIndex(s => s.id === statusId && s.userId === userId);
    if (idx < 0) return false;
    this.data.statuses.splice(idx, 1);
    this.save();
    return true;
  }

  public markStatusViewed(statusId: string, userId: string): StoredStatus | null {
    const st = this.data.statuses.find(s => s.id === statusId);
    if (!st) return null;
    if (!st.viewedBy.includes(userId)) {
      st.viewedBy.push(userId);
      this.save();
    }
    return st;
  }

  public toggleStatusPin(statusId: string, userId: string): StoredStatus | null {
    const st = this.data.statuses.find(s => s.id === statusId);
    if (!st) return null;
    st.pinnedBy = st.pinnedBy || [];
    st.pinnedTimestamps = st.pinnedTimestamps || {};
    if (st.pinnedBy.includes(userId)) {
      st.pinnedBy = st.pinnedBy.filter(id => id !== userId);
      delete st.pinnedTimestamps[userId];
    } else {
      st.pinnedBy.push(userId);
      st.pinnedTimestamps[userId] = Date.now();
    }
    this.save();
    return st;
  }

  public reactToStatus(statusId: string, userId: string, emoji: string): StoredStatus | null {
    const st = this.data.statuses.find(s => s.id === statusId);
    if (!st || !emoji) return null;
    st.reactions = st.reactions || [];
    const idx = st.reactions.findIndex(r => r.emoji === emoji);
    if (idx >= 0) {
      const has = st.reactions[idx].userIds.includes(userId);
      if (has) {
        st.reactions[idx].userIds = st.reactions[idx].userIds.filter(id => id !== userId);
        if (st.reactions[idx].userIds.length === 0) st.reactions.splice(idx, 1);
      } else {
        st.reactions[idx].userIds.push(userId);
      }
    } else {
      st.reactions.push({ emoji, userIds: [userId] });
    }
    this.save();
    return st;
  }

  public getCallsForUser(userId: string): StoredCallRecord[] {
    return this.data.calls.filter(c => c.callerId === userId || c.calleeId === userId);
  }

  public addCallRecord(record: StoredCallRecord): StoredCallRecord {
    this.data.calls.unshift(record);
    this.save();
    return record;
  }

  public clearCallsForUser(userId: string) {
    this.data.calls = this.data.calls.filter(c => c.callerId !== userId && c.calleeId !== userId);
    this.save();
  }

  /* ---------- Contact Synchronization Engine ---------- */
  public getSyncedContactsForUser(userId: string): SyncedContact[] {
    return this.data.syncedContacts
      .filter(c => c.ownerUserId === userId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'));
  }

  public getLastContactSyncAt(userId: string): number | null {
    return this.data.lastContactSyncByUser[userId] || null;
  }

  public getAffectedUsersForPhone(phone: string): string[] {
    const owners = new Set<string>();
    for (const sc of this.data.syncedContacts) {
      if (phonesMatch(sc.phone, phone)) {
        owners.add(sc.ownerUserId);
      }
    }
    return Array.from(owners);
  }

  public syncContactsForUser(
    ownerUserId: string,
    incoming: Array<{ displayName: string; phone: string; email?: string; source?: SyncedContact['source'] }>
  ): {
    contacts: SyncedContact[];
    lastSyncAt: number;
    addedCount: number;
    updatedCount: number;
    matchedCount: number;
  } {
    const now = Date.now();
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of incoming) {
      const cleanName = (item.displayName || '').trim();
      const cleanPhone = (item.phone || '').trim();
      const norm = normalizePhoneNumber(cleanPhone);
      if (!cleanName || !norm) continue;

      const matchedUser = this.data.users.find(
        u => u.id !== ownerUserId && phonesMatch(u.phone, cleanPhone)
      );

      if (matchedUser) {
        this.ensureDmConversation(ownerUserId, matchedUser.id);
      }

      const existing = this.data.syncedContacts.find(
        c => c.ownerUserId === ownerUserId && phonesMatch(c.normalizedPhone, norm)
      );

      if (existing) {
        existing.displayName = cleanName;
        existing.phone = cleanPhone;
        existing.normalizedPhone = norm;
        if (item.email) existing.email = item.email.trim();
        if (item.source) existing.source = item.source;
        existing.registeredUserId = matchedUser?.id;
        existing.syncedAt = now;
        updatedCount += 1;
      } else {
        this.data.syncedContacts.push({
          id: 'sc-' + now + '-' + Math.random().toString(36).slice(2, 6),
          ownerUserId,
          displayName: cleanName,
          phone: cleanPhone,
          normalizedPhone: norm,
          email: item.email?.trim(),
          source: item.source || 'sync',
          registeredUserId: matchedUser?.id,
          syncedAt: now,
        });
        addedCount += 1;
      }
    }

    this.data.lastContactSyncByUser[ownerUserId] = now;
    this.save();

    const contacts = this.getSyncedContactsForUser(ownerUserId);
    const matchedCount = contacts.filter(c => !!c.registeredUserId).length;
    return { contacts, lastSyncAt: now, addedCount, updatedCount, matchedCount };
  }

  public resyncContactsForUser(ownerUserId: string): {
    contacts: SyncedContact[];
    lastSyncAt: number;
    matchedCount: number;
  } {
    const now = Date.now();
    for (const sc of this.data.syncedContacts) {
      if (sc.ownerUserId !== ownerUserId) continue;
      const matchedUser = this.data.users.find(
        u => u.id !== ownerUserId && phonesMatch(u.phone, sc.phone)
      );
      sc.registeredUserId = matchedUser?.id;
      sc.syncedAt = now;
      if (matchedUser) {
        this.ensureDmConversation(ownerUserId, matchedUser.id);
      }
    }
    this.data.lastContactSyncByUser[ownerUserId] = now;
    this.save();

    const contacts = this.getSyncedContactsForUser(ownerUserId);
    return {
      contacts,
      lastSyncAt: now,
      matchedCount: contacts.filter(c => !!c.registeredUserId).length,
    };
  }

  public deleteSyncedContact(ownerUserId: string, contactId: string): SyncedContact[] {
    this.data.syncedContacts = this.data.syncedContacts.filter(
      c => !(c.ownerUserId === ownerUserId && c.id === contactId)
    );
    this.save();
    return this.getSyncedContactsForUser(ownerUserId);
  }

  public clearSyncedContacts(ownerUserId: string): SyncedContact[] {
    this.data.syncedContacts = this.data.syncedContacts.filter(c => c.ownerUserId !== ownerUserId);
    delete this.data.lastContactSyncByUser[ownerUserId];
    this.save();
    return [];
  }

  /* ---------- Channels & Communities ---------- */
  public getChannels(): StoredChannel[] {
    return this.data.channels;
  }

  public toggleFollowChannel(channelId: string, userId: string): StoredChannel[] {
    const ch = this.data.channels.find(c => c.id === channelId);
    if (ch) {
      if (ch.followerIds.includes(userId)) {
        ch.followerIds = ch.followerIds.filter(id => id !== userId);
      } else {
        ch.followerIds.push(userId);
      }
      this.save();
    }
    return this.data.channels;
  }

  public toggleChannelPostReaction(channelId: string, postId: string, userId: string): StoredChannel[] {
    const ch = this.data.channels.find(c => c.id === channelId);
    const post = ch?.posts.find(p => p.id === postId);
    if (post) {
      if (post.reactedBy.includes(userId)) {
        post.reactedBy = post.reactedBy.filter(id => id !== userId);
      } else {
        post.reactedBy.push(userId);
      }
      this.save();
    }
    return this.data.channels;
  }

  public addChannelPost(channelId: string, userId: string, text: string): StoredChannel[] {
    const ch = this.data.channels.find(c => c.id === channelId);
    if (ch && text.trim()) {
      ch.posts.unshift({
        id: 'cp-' + Date.now(),
        text: text.trim(),
        timestamp: 'الآن',
        baseReactions: 1,
        reactedBy: [userId],
      });
      this.save();
    }
    return this.data.channels;
  }

  public createChannel(userId: string, name: string): StoredChannel[] {
    if (!name.trim()) return this.data.channels;
    this.data.channels.unshift({
      id: 'ch-' + Date.now(),
      name: name.trim(),
      avatar: '/src/assets/images/avatar_group_devs_1794862076550.jpg',
      baseFollowers: 1,
      followerIds: [userId],
      verified: false,
      ownerId: userId,
      posts: [
        {
          id: 'cp-' + Date.now(),
          text: `مرحباً بكم في قناة "${name.trim()}" الجديدة!`,
          timestamp: 'الآن',
          baseReactions: 1,
          reactedBy: [userId],
        },
      ],
    });
    this.save();
    return this.data.channels;
  }

  public getCommunities(): StoredCommunity[] {
    return this.data.communities;
  }

  public createCommunity(
    creatorId: string,
    name: string,
    description: string
  ): { communities: StoredCommunity[]; conversation: StoredConversation } {
    const memberIds = Array.from(new Set([creatorId, ...this.data.users.map(u => u.id)]));
    const conv = this.createGroup(creatorId, `إعلانات: ${name.trim()}`, memberIds, [creatorId], description);
    const com: StoredCommunity = {
      id: 'com-' + Date.now(),
      name: name.trim(),
      description: description.trim() || 'مجتمع جديد لتجميع المجموعات ذات الاهتمام المشترك',
      avatar: '/src/assets/images/avatar_group_devs_1794862076550.jpg',
      ownerId: creatorId,
      memberIds,
      groups: [
        {
          id: 'cg-' + Date.now(),
          conversationId: conv.id,
          name: `إعلانات ${name.trim()}`,
          lastMessage: 'تم إنشاء المجتمع وبدء النقاش',
          time: 'الآن',
        },
      ],
    };
    this.data.communities.unshift(com);
    this.save();
    return { communities: this.data.communities, conversation: conv };
  }

  public exportUserDataForBackup(userId: string): {
    profile: { name: string; about: string; avatar: string; phone: string; lastSeenPrivacy?: string };
    conversations: StoredConversation[];
    syncedContacts: StoredSyncedContact[];
    statuses: StoredStatus[];
  } | null {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return null;

    const conversations = this.data.conversations
      .filter(c => c.memberIds.includes(userId))
      .map(c => ({
        ...c,
        messages: c.messages.filter(m => !(m.deletedFor || []).includes(userId)),
      }));

    const syncedContacts = this.data.syncedContacts.filter(c => c.ownerUserId === userId);
    const statuses = this.data.statuses.filter(s => s.userId === userId);

    return {
      profile: {
        name: user.name,
        about: user.about,
        avatar: user.avatar,
        phone: user.phone,
        lastSeenPrivacy: user.lastSeenPrivacy,
      },
      conversations: structuredClone(conversations),
      syncedContacts: structuredClone(syncedContacts),
      statuses: structuredClone(statuses),
    };
  }

  public restoreUserDataFromBackup(
    userId: string,
    payload: {
      profile?: { name?: string; about?: string; avatar?: string; lastSeenPrivacy?: UserAccount['lastSeenPrivacy'] };
      conversations?: StoredConversation[];
      syncedContacts?: StoredSyncedContact[];
      statuses?: StoredStatus[];
    }
  ): {
    restoredMessages: number;
    restoredConversations: number;
    restoredContacts: number;
    restoredStatuses: number;
  } {
    let restoredMessages = 0;
    let restoredConversations = 0;
    let restoredContacts = 0;
    let restoredStatuses = 0;

    const user = this.data.users.find(u => u.id === userId);
    if (user && payload.profile) {
      if (payload.profile.name && !user.name) user.name = payload.profile.name;
      if (payload.profile.about) user.about = payload.profile.about;
      if (payload.profile.avatar && !user.avatar) user.avatar = payload.profile.avatar;
      if (payload.profile.lastSeenPrivacy) user.lastSeenPrivacy = payload.profile.lastSeenPrivacy;
    }

    if (Array.isArray(payload.syncedContacts)) {
      for (const sc of payload.syncedContacts) {
        if (!sc || !sc.phone) continue;
        const exists = this.data.syncedContacts.find(
          x => x.ownerUserId === userId && phonesMatch(x.phone, sc.phone)
        );
        if (!exists) {
          const matchedUser = this.data.users.find(u => u.id !== userId && phonesMatch(u.phone, sc.phone));
          this.data.syncedContacts.push({
            ...sc,
            ownerUserId: userId,
            registeredUserId: matchedUser?.id || sc.registeredUserId,
          });
          restoredContacts++;
        }
      }
    }

    if (Array.isArray(payload.conversations)) {
      for (const bConv of payload.conversations) {
        if (!bConv || !bConv.id) continue;
        const existingConv = this.data.conversations.find(c => c.id === bConv.id);
        if (!existingConv) {
          const cloned = structuredClone(bConv);
          if (!cloned.memberIds.includes(userId)) cloned.memberIds.push(userId);
          this.data.conversations.push(cloned);
          restoredConversations++;
          restoredMessages += cloned.messages.length;
        } else {
          if (!existingConv.memberIds.includes(userId)) {
            existingConv.memberIds.push(userId);
          }
          // Restore per-user conversation preferences
          const togglePref = (arrName: 'pinnedBy' | 'archivedBy' | 'mutedBy' | 'lockedBy' | 'favoriteBy' | 'blockedBy') => {
            const had = Array.isArray(bConv[arrName]) && bConv[arrName]!.includes(userId);
            existingConv[arrName] = existingConv[arrName] || [];
            if (had && !existingConv[arrName]!.includes(userId)) {
              existingConv[arrName]!.push(userId);
            }
          };
          togglePref('pinnedBy');
          togglePref('archivedBy');
          togglePref('mutedBy');
          togglePref('lockedBy');
          togglePref('favoriteBy');
          togglePref('blockedBy');
          if (bConv.notificationTones?.[userId]) {
            existingConv.notificationTones = existingConv.notificationTones || {};
            existingConv.notificationTones[userId] = bConv.notificationTones[userId];
          }
          if (bConv.disappearing && (!existingConv.disappearing || existingConv.disappearing === 'off')) {
            existingConv.disappearing = bConv.disappearing;
          }
          // Restore any missing messages
          const existingMsgIds = new Set(existingConv.messages.map(m => m.id));
          for (const msg of bConv.messages || []) {
            if (msg && msg.id && !existingMsgIds.has(msg.id)) {
              existingConv.messages.push(structuredClone(msg));
              existingMsgIds.add(msg.id);
              restoredMessages++;
            }
          }
          existingConv.messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          restoredConversations++;
        }
      }
    }

    if (Array.isArray(payload.statuses)) {
      const now = Date.now();
      for (const st of payload.statuses) {
        if (!st || !st.id) continue;
        const isPinned = Array.isArray(st.pinnedBy) && st.pinnedBy.includes(userId);
        if ((st.expiresAt > now || isPinned) && !this.data.statuses.some(s => s.id === st.id)) {
          this.data.statuses.push({
            ...structuredClone(st),
            userId,
          });
          restoredStatuses++;
        }
      }
    }

    this.save();
    return { restoredMessages, restoredConversations, restoredContacts, restoredStatuses };
  }
}

export const store = new PersistentStore();
