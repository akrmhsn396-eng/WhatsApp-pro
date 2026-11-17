/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const AUTH_DB_FILE = path.join(DATA_DIR, 'auth.db');

export interface AuthAccountRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  about: string;
  avatar: string;
  two_factor_hash: string | null;
  failed_login_count: number;
  locked_until: number | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export interface AuthSessionRow {
  id: string;
  token_hash: string;
  refresh_token_hash: string;
  account_id: string;
  email: string;
  device_name: string;
  user_agent: string | null;
  ip_address: string | null;
  revoked: number;
  created_at: number;
  last_active_at: number;
  expires_at: number;
}

export interface AuthAuditLogRow {
  id: string;
  account_id: string | null;
  email: string;
  event_type: string;
  status: 'success' | 'failure' | 'blocked';
  ip_address: string | null;
  device_name: string | null;
  details: string | null;
  created_at: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

class EmailAuthDatabase {
  private db: DatabaseSync;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new DatabaseSync(AUTH_DB_FILE);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS auth_accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        about TEXT NOT NULL DEFAULT '',
        avatar TEXT NOT NULL DEFAULT '',
        two_factor_hash TEXT,
        failed_login_count INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_login_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON auth_accounts(email);

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        device_name TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        revoked INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_account ON auth_sessions(account_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON auth_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON auth_sessions(refresh_token_hash);

      CREATE TABLE IF NOT EXISTS auth_audit_logs (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        email TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'failure', 'blocked')),
        ip_address TEXT,
        device_name TEXT,
        details TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_account_time ON auth_audit_logs(account_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_email_time ON auth_audit_logs(email, created_at DESC);
    `);
  }

  public bootstrapAccounts(
    users: Array<{
      id: string;
      name: string;
      email?: string;
      phone?: string;
      about?: string;
      avatar?: string;
      twoFactorPinHash?: string;
      registeredAt?: number;
    }>
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO auth_accounts (
        id, email, password_hash, display_name, about, avatar,
        two_factor_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        about = excluded.about,
        avatar = excluded.avatar,
        updated_at = excluded.updated_at
    `);

    const now = Date.now();
    this.db.exec('BEGIN');
    try {
      for (const u of users) {
        const email = (u.email || u.phone || `${u.id}@whatsapp.pro`).trim().toLowerCase();
        if (!email) continue;
        const existing = this.findAccountByEmail(email);
        if (existing && existing.id !== u.id) continue;
        const dummyPasswordHash = hashPassword('Password123!');
        stmt.run(
          u.id,
          email,
          dummyPasswordHash,
          u.name,
          u.about || '',
          u.avatar || '',
          u.twoFactorPinHash || null,
          u.registeredAt || now,
          now
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public findAccountById(id: string): AuthAccountRow | undefined {
    return this.db.prepare('SELECT * FROM auth_accounts WHERE id = ?').get(id) as AuthAccountRow | undefined;
  }

  public findAccountByEmail(email: string): AuthAccountRow | undefined {
    if (!email) return undefined;
    return this.db
      .prepare('SELECT * FROM auth_accounts WHERE email = ?')
      .get(email.trim().toLowerCase()) as AuthAccountRow | undefined;
  }

  public searchAccounts(query: string): AuthAccountRow[] {
    if (!query || !query.trim()) return [];
    const q = `%${query.trim().toLowerCase()}%`;
    return this.db
      .prepare('SELECT * FROM auth_accounts WHERE lower(email) LIKE ? OR lower(display_name) LIKE ? LIMIT 20')
      .all(q, q) as unknown as AuthAccountRow[];
  }

  public upsertAccount(input: {
    id: string;
    email: string;
    password?: string;
    displayName: string;
    about?: string;
    avatar?: string;
  }): AuthAccountRow {
    const now = Date.now();
    const email = input.email.trim().toLowerCase();
    const existing = this.findAccountByEmail(email);
    const targetId = existing ? existing.id : input.id;
    const passwordHash = input.password ? hashPassword(input.password) : existing?.password_hash || hashPassword('Password123!');

    this.db
      .prepare(`
        INSERT INTO auth_accounts (
          id, email, password_hash, display_name, about, avatar,
          created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          display_name = excluded.display_name,
          about = excluded.about,
          avatar = excluded.avatar,
          updated_at = excluded.updated_at
      `)
      .run(
        targetId,
        email,
        passwordHash,
        input.displayName.trim(),
        input.about || '',
        input.avatar || '',
        now,
        now,
        now
      );
    return this.findAccountById(targetId)!;
  }

  public markAccountLogin(accountId: string) {
    const now = Date.now();
    this.db
      .prepare(`
        UPDATE auth_accounts
        SET failed_login_count = 0,
            locked_until = NULL,
            last_login_at = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(now, now, accountId);
  }

  public recordFailedLogin(accountId: string): { lockedUntil: number | null; attempts: number } {
    const acc = this.findAccountById(accountId);
    const nextCount = (acc?.failed_login_count || 0) + 1;
    const lockedUntil = nextCount >= 5 ? Date.now() + 5 * 60 * 1000 : null;
    this.db
      .prepare('UPDATE auth_accounts SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?')
      .run(nextCount, lockedUntil, Date.now(), accountId);
    return { lockedUntil, attempts: nextCount };
  }

  public setTwoFactorHash(accountId: string, hash: string | null) {
    this.db
      .prepare('UPDATE auth_accounts SET two_factor_hash = ?, updated_at = ? WHERE id = ?')
      .run(hash, Date.now(), accountId);
  }

  public updateAccountPassword(accountId: string, newPassword: string) {
    const now = Date.now();
    this.db
      .prepare(
        'UPDATE auth_accounts SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?'
      )
      .run(hashPassword(newPassword), now, accountId);
  }

  /* ---------- Sessions ---------- */
  public createSession(input: {
    id: string;
    rawToken: string;
    rawRefreshToken: string;
    accountId: string;
    email: string;
    deviceName: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: number;
  }): AuthSessionRow {
    const now = Date.now();
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked = 1').run(now - 7 * 24 * 60 * 60 * 1000);
    const tokenHash = sha256Hex(input.rawToken);
    const refreshHash = sha256Hex(input.rawRefreshToken);

    this.db
      .prepare(`
        INSERT INTO auth_sessions (
          id, token_hash, refresh_token_hash, account_id, email,
          device_name, user_agent, ip_address, revoked, created_at, last_active_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `)
      .run(
        input.id,
        tokenHash,
        refreshHash,
        input.accountId,
        input.email,
        input.deviceName,
        input.userAgent || null,
        input.ipAddress || null,
        now,
        now,
        input.expiresAt
      );
    return this.db.prepare('SELECT * FROM auth_sessions WHERE id = ?').get(input.id) as unknown as AuthSessionRow;
  }

  public getSessionByRawToken(rawToken: string, touch = true): AuthSessionRow | undefined {
    if (!rawToken) return undefined;
    const hash = sha256Hex(rawToken);
    const now = Date.now();
    const row = this.db
      .prepare('SELECT * FROM auth_sessions WHERE token_hash = ? AND revoked = 0 AND expires_at > ?')
      .get(hash, now) as AuthSessionRow | undefined;
    if (row && touch) {
      this.db.prepare('UPDATE auth_sessions SET last_active_at = ? WHERE id = ?').run(now, row.id);
      row.last_active_at = now;
    }
    return row;
  }

  public getActiveSessionsForAccount(accountId: string): AuthSessionRow[] {
    const now = Date.now();
    return this.db
      .prepare('SELECT * FROM auth_sessions WHERE account_id = ? AND revoked = 0 AND expires_at > ? ORDER BY last_active_at DESC')
      .all(accountId, now) as unknown as AuthSessionRow[];
  }

  public revokeSessionById(sessionId: string, accountId: string): AuthSessionRow | undefined {
    const row = this.db
      .prepare('SELECT * FROM auth_sessions WHERE id = ? AND account_id = ? AND revoked = 0')
      .get(sessionId, accountId) as AuthSessionRow | undefined;
    if (!row) return undefined;
    this.db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE id = ?').run(sessionId);
    return row;
  }

  public revokeSessionByRawToken(rawToken: string): AuthSessionRow | undefined {
    const hash = sha256Hex(rawToken);
    const row = this.db
      .prepare('SELECT * FROM auth_sessions WHERE token_hash = ? AND revoked = 0')
      .get(hash) as AuthSessionRow | undefined;
    if (!row) return undefined;
    this.db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE id = ?').run(row.id);
    return row;
  }

  public revokeOtherSessions(accountId: string, keepSessionId: string): AuthSessionRow[] {
    const others = this.db
      .prepare('SELECT * FROM auth_sessions WHERE account_id = ? AND id != ? AND revoked = 0')
      .all(accountId, keepSessionId) as unknown as AuthSessionRow[];
    if (others.length > 0) {
      this.db
        .prepare('UPDATE auth_sessions SET revoked = 1 WHERE account_id = ? AND id != ?')
        .run(accountId, keepSessionId);
    }
    return others;
  }

  /* ---------- Audit Logs ---------- */
  public logAudit(entry: {
    accountId?: string | null;
    email: string;
    eventType: string;
    status: 'success' | 'failure' | 'blocked';
    ipAddress?: string;
    deviceName?: string;
    details?: string;
  }) {
    const id = 'aud-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    this.db
      .prepare(`
        INSERT INTO auth_audit_logs (
          id, account_id, email, event_type, status, ip_address, device_name, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        entry.accountId || null,
        entry.email,
        entry.eventType,
        entry.status,
        entry.ipAddress || null,
        entry.deviceName || null,
        entry.details || null,
        Date.now()
      );
  }

  public getAuditLogsForAccount(accountId: string, limit = 40): AuthAuditLogRow[] {
    return this.db
      .prepare('SELECT * FROM auth_audit_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(accountId, limit) as unknown as AuthAuditLogRow[];
  }

  public getHealthStats() {
    const now = Date.now();
    const accountsRow = this.db.prepare('SELECT COUNT(*) as cnt FROM auth_accounts').get() as { cnt: number };
    const sessionsRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM auth_sessions WHERE revoked = 0 AND expires_at > ?')
      .get(now) as { cnt: number };
    const auditRow = this.db.prepare('SELECT COUNT(*) as cnt FROM auth_audit_logs').get() as { cnt: number };

    return {
      engine: 'sqlite',
      dbPath: 'data/auth.db',
      accountsCount: accountsRow?.cnt || 0,
      activeSessionsCount: sessionsRow?.cnt || 0,
      auditLogsCount: auditRow?.cnt || 0,
    };
  }
}

export const authDb = new EmailAuthDatabase();
